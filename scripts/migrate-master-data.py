#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data Migration Script: Master Data (Drugs/Medical Supplies)
============================================================

This script migrates drug/medical supply master data from JHCIS (jhcisdb)
to the new Inventory & Procurement system.

Source Tables:
- cdrug (main drug master)

Target Tables:
- products
- categories (auto-created from drug types)

Author: Data Engineer
Date: 2026-03-29
"""

import json
import logging
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field, asdict
import hashlib

try:
    import pymysql
    from pymysql.cursors import DictCursor
except ImportError:
    print("ERROR: pymysql not installed. Run: pip install pymysql")
    sys.exit(1)

try:
    import pandas as pd
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
except ImportError:
    print("WARNING: pandas not installed. Some features may be limited.")
    pd = None

# ==============================================================================
# Configuration
# ==============================================================================

@dataclass
class DatabaseConfig:
    host: str = "localhost"
    port: int = 3306
    user: str = "root"
    password: str = ""
    database: str = ""
    charset: str = "utf8mb4"

@dataclass
class MigrationConfig:
    batch_size: int = 1000
    dry_run: bool = False
    validate_before_import: bool = True
    create_backup: bool = True
    stop_on_error: bool = False
    log_level: str = "INFO"

# ==============================================================================
# Logger Setup
# ==============================================================================

def setup_logger(log_dir: str, log_prefix: str) -> logging.Logger:
    """Setup logging with file and console handlers."""
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = log_path / f"{log_prefix}_{timestamp}.log"
    
    logger = logging.getLogger("migration")
    logger.setLevel(getattr(logging, "INFO", logging.INFO))
    
    # File handler
    fh = logging.FileHandler(log_file, encoding='utf-8')
    fh.setLevel(logging.DEBUG)
    
    # Console handler
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    fh.setFormatter(formatter)
    ch.setFormatter(formatter)
    
    logger.addHandler(fh)
    logger.addHandler(ch)
    
    return logger

# ==============================================================================
# Database Connection Manager
# ==============================================================================

class DatabaseManager:
    """Manages database connections with connection pooling simulation."""
    
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self._connection = None
    
    def connect(self) -> pymysql.Connection:
        """Create a database connection."""
        if self._connection is None or not self._connection.open:
            self._connection = pymysql.connect(
                host=self.config.host,
                port=self.config.port,
                user=self.config.user,
                password=self.config.password,
                database=self.config.database,
                charset=self.config.charset,
                cursorclass=DictCursor
            )
        return self._connection
    
    def disconnect(self):
        """Close the database connection."""
        if self._connection and self._connection.open:
            self._connection.close()
            self._connection = None
    
    def __enter__(self):
        return self.connect()
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()

# ==============================================================================
# Data Cleansing Functions
# ==============================================================================

class DataCleanser:
    """Handles data cleaning and transformation."""
    
    DRUG_TYPE_MAP = {
        "01": "ยาเม็ด",
        "02": "ยาแคปซูล",
        "03": "ยาน้ำ",
        "04": "ยาฉีด",
        "05": "ยาภายนอก",
        "06": "ยาเตรียมพิเศษ",
        "07": "เวชภัณฑ์",
        "08": "วัสดุสิ้นเปลือง",
        "09": "อุปกรณ์การแพทย์",
        "10": "เวชภัณฑ์อื่นๆ"
    }
    
    @staticmethod
    def clean_string(value: Any, max_length: int = 255) -> Optional[str]:
        """Clean and trim string values."""
        if value is None:
            return None
        value = str(value).strip()
        if not value or value.upper() == 'NULL':
            return None
        return value[:max_length] if len(value) > max_length else value
    
    @staticmethod
    def clean_number(value: Any, default: float = 0.0) -> float:
        """Clean and convert numeric values."""
        if value is None:
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def clean_date(value: Any) -> Optional[str]:
        """Clean and format date values."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d')
        if isinstance(value, str):
            try:
                # Try parsing various date formats
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y%m%d']:
                    try:
                        dt = datetime.strptime(value, fmt)
                        return dt.strftime('%Y-%m-%d')
                    except ValueError:
                        continue
            except Exception:
                pass
        return None
    
    @staticmethod
    def generate_checksum(row: Dict) -> str:
        """Generate checksum for row comparison."""
        important_fields = ['drugcode', 'drugname', 'cost', 'sell']
        values = [str(row.get(f, '')) for f in important_fields]
        combined = '|'.join(values)
        return hashlib.md5(combined.encode()).hexdigest()
    
    @classmethod
    def map_drug_type(cls, drug_type: Optional[str]) -> Tuple[str, str]:
        """Map drug type code to category name."""
        if not drug_type:
            return ("99", "อื่นๆ")
        code = str(drug_type).strip().zfill(2)[:2]
        return (code, cls.DRUG_TYPE_MAP.get(code, "อื่นๆ"))

# ==============================================================================
# Validation Functions
# ==============================================================================

class DataValidator:
    """Validates data before import."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.errors: List[Dict] = []
        self.warnings: List[Dict] = []
    
    def validate_drug_record(self, record: Dict) -> Tuple[bool, List[str]]:
        """Validate a single drug record."""
        issues = []
        
        # Required fields
        if not record.get('drugcode'):
            issues.append("Missing drugcode (primary key)")
        
        if not record.get('drugname'):
            issues.append("Missing drugname")
        
        # Validate cost/sell prices
        cost = DataCleanser.clean_number(record.get('cost'), -1)
        sell = DataCleanser.clean_number(record.get('sell'), -1)
        
        if cost < 0:
            issues.append(f"Invalid cost: {record.get('cost')}")
        
        if sell < 0:
            issues.append(f"Invalid sell: {record.get('sell')}")
        
        # Validate dates
        if record.get('dateexpire'):
            expire_date = DataCleanser.clean_date(record.get('dateexpire'))
            if expire_date:
                try:
                    if datetime.strptime(expire_date, '%Y-%m-%d') < datetime.now():
                        self.warnings.append({
                            'drugcode': record.get('drugcode'),
                            'warning': f"Expired date: {expire_date}"
                        })
                except ValueError:
                    issues.append(f"Invalid expire date format: {record.get('dateexpire')}")
        
        # Check for duplicates (will be done in batch)
        
        return (len(issues) == 0, issues)
    
    def add_error(self, record: Dict, error: str):
        """Record validation error."""
        self.errors.append({
            'record': record,
            'error': error,
            'timestamp': datetime.now().isoformat()
        })
        self.logger.error(f"Validation error for {record.get('drugcode')}: {error}")
    
    def get_summary(self) -> Dict:
        """Get validation summary."""
        return {
            'total_errors': len(self.errors),
            'total_warnings': len(self.warnings),
            'errors': self.errors[:100],  # Limit for report
            'warnings': self.warnings[:100]
        }

# ==============================================================================
# Migration Statistics
# ==============================================================================

@dataclass
class MigrationStats:
    """Tracks migration statistics."""
    total_source_records: int = 0
    total_valid_records: int = 0
    total_invalid_records: int = 0
    total_imported: int = 0
    total_updated: int = 0
    total_skipped: int = 0
    total_errors: int = 0
    start_time: datetime = None
    end_time: datetime = None
    categories_created: int = 0
    
    def duration_seconds(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0
    
    def to_dict(self) -> Dict:
        return {
            'total_source_records': self.total_source_records,
            'total_valid_records': self.total_valid_records,
            'total_invalid_records': self.total_invalid_records,
            'total_imported': self.total_imported,
            'total_updated': self.total_updated,
            'total_skipped': self.total_skipped,
            'total_errors': self.total_errors,
            'categories_created': self.categories_created,
            'duration_seconds': self.duration_seconds(),
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None
        }

# ==============================================================================
# Main Migration Class
# ==============================================================================

class MasterDataMigrator:
    """Main class for migrating master data."""
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or self._get_default_config_path()
        self.config = self._load_config()
        self.stats = MigrationStats()
        self.logger = setup_logger(
            self.config.get('logging', {}).get('log_dir', './logs/migration'),
            'master_data'
        )
        self.validator = DataValidator(self.logger)
        self.cleanser = DataCleanser()
        
        # Database connections
        self.source_db: Optional[DatabaseManager] = None
        self.target_db: Optional[DatabaseManager] = None
    
    def _get_default_config_path(self) -> str:
        """Get default config path."""
        script_dir = Path(__file__).parent
        return str(script_dir / "migration-config.json")
    
    def _load_config(self) -> Dict:
        """Load configuration from JSON file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            self._create_default_config(self.config_path)
            return self._load_config()
    
    def _create_default_config(self, path: str):
        """Create default configuration file."""
        default_config = {
            "source": {
                "type": "mysql",
                "host": "localhost",
                "port": 3333,
                "user": "root",
                "password": "123456",
                "database": "jhcisdb",
                "charset": "utf8mb4"
            },
            "target": {
                "type": "mysql",
                "host": "localhost",
                "port": 3306,
                "user": "root",
                "password": "",
                "database": "inventory_procurement",
                "charset": "utf8mb4"
            },
            "migration": {
                "batch_size": 1000,
                "dry_run": False,
                "validate_before_import": True,
                "create_backup": True,
                "stop_on_error": False,
                "log_level": "INFO"
            },
            "logging": {
                "log_dir": "./logs/migration",
                "log_file_prefix": "migration"
            }
        }
        
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=2, ensure_ascii=False)
    
    def connect_databases(self):
        """Establish database connections."""
        source_cfg = self.config['source']
        target_cfg = self.config['target']
        
        self.source_db = DatabaseManager(DatabaseConfig(
            host=source_cfg['host'],
            port=source_cfg['port'],
            user=source_cfg['user'],
            password=source_cfg['password'],
            database=source_cfg['database'],
            charset=source_cfg.get('charset', 'utf8mb4')
        ))
        
        self.target_db = DatabaseManager(DatabaseConfig(
            host=target_cfg['host'],
            port=target_cfg['port'],
            user=target_cfg['user'],
            password=target_cfg['password'],
            database=target_cfg['database'],
            charset=target_cfg.get('charset', 'utf8mb4')
        ))
        
        self.logger.info("Database connections established")
    
    def disconnect_databases(self):
        """Close database connections."""
        if self.source_db:
            self.source_db.disconnect()
        if self.target_db:
            self.target_db.disconnect()
        self.logger.info("Database connections closed")
    
    def fetch_source_data(self) -> List[Dict]:
        """Fetch all drug records from source database."""
        self.logger.info("Fetching source data from cdrug table...")
        
        query = """
            SELECT 
                drugcode,
                drugname,
                drugnamethai,
                druggenericname,
                drugtype,
                drugtypesub,
                drugcategory,
                `pack`,
                unitsell,
                unitusage,
                unitpacking,
                cost,
                sell,
                costcaldrugstore,
                sellcaldrugstore,
                lotno,
                dateexpire,
                drugcodeold,
                tmtcode,
                tcode,
                drugproperties,
                drugcaution,
                antibio,
                `claim`,
                chargeitem,
                chargelist,
                amountdefaultpay,
                amountstartdrugstore,
                daystockremain,
                stockempty,
                drugflag
            FROM cdrug
            ORDER BY drugcode
        """
        
        with self.source_db.connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                records = cursor.fetchall()
                self.logger.info(f"Fetched {len(records)} records from source")
                return list(records)
    
    def cleanse_data(self, records: List[Dict]) -> List[Dict]:
        """Cleanse and transform source data."""
        self.logger.info("Cleansing data...")
        
        cleansed_records = []
        seen_drugcodes = set()
        duplicates = 0
        
        for record in records:
            # Skip duplicates
            drugcode = record.get('drugcode', '')
            if drugcode in seen_drugcodes:
                duplicates += 1
                continue
            seen_drugcodes.add(drugcode)
            
            # Cleanse each field
            cleansed = {
                'drugcode': self.cleanser.clean_string(record.get('drugcode'), 24),
                'drugname': self.cleanser.clean_string(record.get('drugname'), 255),
                'drugnamethai': self.cleanser.clean_string(record.get('drugnamethai'), 255),
                'druggenericname': self.cleanser.clean_string(record.get('druggenericname'), 220),
                'drugtype': self.cleanser.clean_string(record.get('drugtype'), 2),
                'drugtypesub': self.cleanser.clean_string(record.get('drugtypesub'), 2),
                'drugcategory': self.cleanser.clean_string(record.get('drugcategory'), 50),
                'pack': self.cleanser.clean_string(record.get('pack'), 255),
                'unitsell': self.cleanser.clean_string(record.get('unitsell'), 15),
                'unitusage': self.cleanser.clean_string(record.get('unitusage'), 15),
                'unitpacking': self.cleanser.clean_string(record.get('unitpacking'), 50),
                'cost': self.cleanser.clean_number(record.get('cost')),
                'sell': self.cleanser.clean_number(record.get('sell')),
                'costcaldrugstore': self.cleanser.clean_number(record.get('costcaldrugstore')),
                'sellcaldrugstore': self.cleanser.clean_number(record.get('sellcaldrugstore')),
                'lotno': self.cleanser.clean_string(record.get('lotno'), 20),
                'dateexpire': self.cleanser.clean_date(record.get('dateexpire')),
                'drugcodeold': self.cleanser.clean_string(record.get('drugcodeold'), 50),
                'tmtcode': self.cleanser.clean_string(record.get('tmtcode'), 55),
                'tcode': self.cleanser.clean_string(record.get('tcode'), 255),
                'drugproperties': self.cleanser.clean_string(record.get('drugproperties'), 255),
                'drugcaution': self.cleanser.clean_string(record.get('drugcaution'), 255),
                'antibio': self.cleanser.clean_string(record.get('antibio'), 1),
                'claim': self.cleanser.clean_number(record.get('claim')),
                'chargeitem': self.cleanser.clean_string(record.get('chargeitem'), 2),
                'chargelist': self.cleanser.clean_string(record.get('chargelist'), 6),
                'amountdefaultpay': int(record.get('amountdefaultpay') or 0),
                'amountstartdrugstore': int(record.get('amountstartdrugstore') or 0),
                'daystockremain': int(record.get('daystockremain') or 0),
                'stockempty': self.cleanser.clean_string(record.get('stockempty'), 1) == '1',
                'drugflag': self.cleanser.clean_string(record.get('drugflag'), 1),
                'source_checksum': self.cleanser.generate_checksum(record)
            }
            
            cleansed_records.append(cleansed)
        
        self.logger.info(f"Cleansed {len(cleansed_records)} records, removed {duplicates} duplicates")
        return cleansed_records
    
    def validate_data(self, records: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Validate cleansed data."""
        self.logger.info("Validating data...")
        
        valid_records = []
        invalid_records = []
        
        for record in records:
            is_valid, issues = self.validator.validate_drug_record(record)
            
            if is_valid:
                valid_records.append(record)
            else:
                invalid_records.append({
                    'record': record,
                    'issues': issues
                })
                self.stats.total_invalid_records += 1
        
        self.logger.info(f"Validation complete: {len(valid_records)} valid, {len(invalid_records)} invalid")
        return valid_records, invalid_records
    
    def ensure_categories(self, records: List[Dict]) -> Dict[str, int]:
        """Ensure all categories exist in target database."""
        self.logger.info("Ensuring categories exist...")
        
        # Extract unique drug types
        drug_types = set()
        for record in records:
            drug_type = record.get('drugtype', '99')
            if drug_type:
                drug_types.add(drug_type.zfill(2)[:2])
        
        category_map = {}
        
        with self.target_db.connect() as conn:
            with conn.cursor() as cursor:
                for code in sorted(drug_types):
                    name = DataCleanser.DRUG_TYPE_MAP.get(code, "อื่นๆ")
                    
                    # Check if exists
                    cursor.execute(
                        "SELECT id FROM categories WHERE category_code = %s",
                        (code,)
                    )
                    result = cursor.fetchone()
                    
                    if result:
                        category_map[code] = result['id']
                    else:
                        # Insert new category
                        cursor.execute("""
                            INSERT INTO categories (category_code, category_name, description, is_active, created_at)
                            VALUES (%s, %s, %s, 1, NOW())
                        """, (code, name, f"ประเภท {name}"))
                        category_map[code] = cursor.lastrowid
                        self.stats.categories_created += 1
                        self.logger.info(f"Created category: {code} - {name}")
            
            conn.commit()
        
        self.logger.info(f"Categories ready: {len(category_map)} categories")
        return category_map
    
    def import_data(self, records: List[Dict], category_map: Dict[str, int]) -> bool:
        """Import cleansed and validated data into target database."""
        self.logger.info("Starting data import...")
        
        batch_size = self.config.get('migration', {}).get('batch_size', 1000)
        is_dry_run = self.config.get('migration', {}).get('dry_run', False)
        
        if is_dry_run:
            self.logger.info("DRY RUN MODE - No data will be written")
            self.stats.total_imported = len(records)
            return True
        
        total_batches = (len(records) + batch_size - 1) // batch_size
        imported = 0
        updated = 0
        skipped = 0
        errors = 0
        
        with self.target_db.connect() as conn:
            for batch_num in range(total_batches):
                start_idx = batch_num * batch_size
                end_idx = min(start_idx + batch_size, len(records))
                batch = records[start_idx:end_idx]
                
                self.logger.info(f"Processing batch {batch_num + 1}/{total_batches} ({start_idx + 1}-{end_idx})")
                
                for record in batch:
                    try:
                        # Get category ID
                        drug_type = (record.get('drugtype') or '99').zfill(2)[:2]
                        category_id = category_map.get(drug_type, None)
                        
                        # Check if product exists
                        with conn.cursor() as cursor:
                            cursor.execute(
                                "SELECT id FROM products WHERE product_code = %s",
                                (record['drugcode'],)
                            )
                            existing = cursor.fetchone()
                            
                            if existing:
                                # Update existing record
                                update_query = """
                                    UPDATE products SET
                                        product_name = %s,
                                        product_name_thai = %s,
                                        generic_name = %s,
                                        category_id = %s,
                                        pack_size = %s,
                                        unit_sell = %s,
                                        unit_usage = %s,
                                        cost_price = %s,
                                        sell_price = %s,
                                        lot_number = %s,
                                        expiry_date = %s,
                                        old_code = %s,
                                        tmt_code = %s,
                                        properties = %s,
                                        caution = %s,
                                        is_antibiotic = %s,
                                        is_active = %s,
                                        updated_at = NOW(),
                                        source_checksum = %s
                                    WHERE product_code = %s
                                """
                                cursor.execute(update_query, (
                                    record.get('drugname'),
                                    record.get('drugnamethai'),
                                    record.get('druggenericname'),
                                    category_id,
                                    record.get('pack'),
                                    record.get('unitsell'),
                                    record.get('unitusage'),
                                    record.get('cost'),
                                    record.get('sell'),
                                    record.get('lotno'),
                                    record.get('dateexpire'),
                                    record.get('drugcodeold'),
                                    record.get('tmtcode'),
                                    record.get('drugproperties'),
                                    record.get('drugcaution'),
                                    1 if record.get('antibio') == '1' else 0,
                                    0 if record.get('stockempty') == '1' else 1,
                                    record.get('source_checksum'),
                                    record['drugcode']
                                ))
                                updated += 1
                            else:
                                # Insert new record
                                insert_query = """
                                    INSERT INTO products (
                                        product_code, product_name, product_name_thai, generic_name,
                                        category_id, pack_size, unit_sell, unit_usage,
                                        cost_price, sell_price, lot_number, expiry_date,
                                        old_code, tmt_code, properties, caution,
                                        is_antibiotic, is_active, source_checksum, created_at, updated_at
                                    ) VALUES (
                                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                                    )
                                """
                                cursor.execute(insert_query, (
                                    record['drugcode'],
                                    record.get('drugname'),
                                    record.get('drugnamethai'),
                                    record.get('druggenericname'),
                                    category_id,
                                    record.get('pack'),
                                    record.get('unitsell'),
                                    record.get('unitusage'),
                                    record.get('cost'),
                                    record.get('sell'),
                                    record.get('lotno'),
                                    record.get('dateexpire'),
                                    record.get('drugcodeold'),
                                    record.get('tmtcode'),
                                    record.get('drugproperties'),
                                    record.get('drugcaution'),
                                    1 if record.get('antibio') == '1' else 0,
                                    0 if record.get('stockempty') == '1' else 1,
                                    record.get('source_checksum')
                                ))
                                imported += 1
                    except Exception as e:
                        errors += 1
                        self.logger.error(f"Error importing {record.get('drugcode')}: {str(e)}")
                        
                        if self.config.get('migration', {}).get('stop_on_error', False):
                            conn.rollback()
                            return False
                
                conn.commit()
        
        self.stats.total_imported = imported
        self.stats.total_updated = updated
        self.stats.total_skipped = skipped
        self.stats.total_errors = errors
        
        self.logger.info(f"Import complete: {imported} imported, {updated} updated, {errors} errors")
        return True
    
    def generate_report(self) -> Dict:
        """Generate migration report."""
        report = {
            'migration_type': 'Master Data (Drugs/Medical Supplies)',
            'status': 'SUCCESS' if self.stats.total_errors == 0 else 'COMPLETED_WITH_ERRORS',
            'statistics': self.stats.to_dict(),
            'validation_summary': self.validator.get_summary(),
            'timestamp': datetime.now().isoformat()
        }
        
        # Save report
        report_dir = Path(self.config.get('logging', {}).get('log_dir', './logs/migration'))
        report_dir.mkdir(parents=True, exist_ok=True)
        
        report_file = report_dir / f"master_data_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Report saved to: {report_file}")
        return report
    
    def run(self) -> bool:
        """Execute the full migration pipeline."""
        self.logger.info("=" * 60)
        self.logger.info("Starting Master Data Migration")
        self.logger.info("=" * 60)
        
        self.stats.start_time = datetime.now()
        
        try:
            # Connect databases
            self.connect_databases()
            
            # Fetch source data
            source_records = self.fetch_source_data()
            self.stats.total_source_records = len(source_records)
            
            # Cleanse data
            cleansed_records = self.cleanse_data(source_records)
            
            # Validate data
            if self.config.get('migration', {}).get('validate_before_import', True):
                valid_records, invalid_records = self.validate_data(cleansed_records)
            else:
                valid_records = cleansed_records
                invalid_records = []
            
            # Ensure categories exist
            category_map = self.ensure_categories(valid_records)
            
            # Import data
            success = self.import_data(valid_records, category_map)
            
            if not success:
                self.logger.error("Migration failed!")
                return False
            
            # Generate report
            report = self.generate_report()
            
            self.logger.info("=" * 60)
            self.logger.info("Migration Complete!")
            self.logger.info(f"Total records processed: {self.stats.total_source_records}")
            self.logger.info(f"Records imported: {self.stats.total_imported}")
            self.logger.info(f"Records updated: {self.stats.total_updated}")
            self.logger.info(f"Records invalid: {self.stats.total_invalid_records}")
            self.logger.info(f"Errors: {self.stats.total_errors}")
            self.logger.info("=" * 60)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Migration error: {str(e)}", exc_info=True)
            return False
            
        finally:
            self.stats.end_time = datetime.now()
            self.disconnect_databases()

# ==============================================================================
# Entry Point
# ==============================================================================

def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate master data from JHCIS to Inventory System')
    parser.add_argument('--config', '-c', help='Path to configuration file', default=None)
    parser.add_argument('--dry-run', '-n', help='Dry run (no data written)', action='store_true')
    parser.add_argument('--verbose', '-v', help='Verbose output', action='store_true')
    
    args = parser.parse_args()
    
    migrator = MasterDataMigrator(config_path=args.config)
    
    if args.dry_run:
        migrator.config['migration']['dry_run'] = True
        print("DRY RUN MODE ENABLED")
    
    if args.verbose:
        migrator.logger.setLevel(logging.DEBUG)
    
    success = migrator.run()
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()