#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data Migration Script: Suppliers
================================

This script migrates supplier/vendor data from JHCIS (jhcisdb)
to the new Inventory & Procurement system.

Source Tables:
- drugstorereceive (contains companyname field)

Target Tables:
- suppliers

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
from dataclasses import dataclass
import re

try:
    import pymysql
    from pymysql.cursors import DictCursor
except ImportError:
    print("ERROR: pymysql not installed. Run: pip install pymysql")
    sys.exit(1)

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

# ==============================================================================
# Logger Setup
# ==============================================================================

def setup_logger(log_dir: str, log_prefix: str) -> logging.Logger:
    """Setup logging with file and console handlers."""
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = log_path / f"{log_prefix}_{timestamp}.log"
    
    logger = logging.getLogger("supplier_migration")
    logger.setLevel(logging.INFO)
    
    # Clear existing handlers
    logger.handlers.clear()
    
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
    """Manages database connections."""
    
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

class SupplierCleanser:
    """Handles supplier data cleaning and transformation."""
    
    # Common Thai company name patterns
    COMPANY_PREFIXES = [
        'บริษัท', 'บจก.', 'บ.จ.', 'จำกัด', 'ห้างหุ้นส่วน',
        'หจ.', 'ห้าง', 'ร้าน', 'คลินิก', 'โรงพยาบาล', 'สำนักงาน',
        'เอกชน', 'ภาครัฐ'
    ]
    
    # Known supplier categories
    SUPPLIER_CATEGORIES = {
        'ยา': 'pharmaceutical',
        'เวชภัณฑ์': 'medical_supplies',
        'อุปกรณ์': 'equipment',
        'วัสดุ': 'supplies',
        'ทั่วไป': 'general'
    }
    
    @staticmethod
    def clean_company_name(name: Any) -> Optional[str]:
        """Clean and normalize company name."""
        if not name:
            return None
        
        name = str(name).strip()
        
        # Remove extra whitespace
        name = re.sub(r'\s+', ' ', name)
        
        # Remove null/empty markers
        if name.upper() in ['NULL', 'N/A', '-', '']:
            return None
        
        return name
    
    @staticmethod
    def extract_supplier_info(name: str) -> Dict:
        """Extract supplier information from company name."""
        if not name:
            return {
                'name': name,
                'type': 'unknown',
                'is_government': False
            }
        
        info = {
            'name': name,
            'type': 'private',
            'is_government': False
        }
        
        # Check for government organizations
        gov_keywords = ['โรงพยาบาล', 'สาธารณสุข', 'อบต.', 'เทศบาล', 'องค์การ', 'กรม', 'กระทรวง']
        for keyword in gov_keywords:
            if keyword in name:
                info['is_government'] = True
                info['type'] = 'government'
                break
        
        # Identify company type
        if 'บริษัท' in name or 'บจก.' in name or 'จำกัด' in name:
            info['type'] = 'limited_company'
        elif 'ห้างหุ้นส่วน' in name or 'หจ.' in name:
            info['type'] = 'partnership'
        elif 'ร้าน' in name:
            info['type'] = 'shop'
        
        return info
    
    @staticmethod
    def generate_supplier_code(name: str, index: int = 0) -> str:
        """Generate a supplier code from company name."""
        if not name:
            return f"SUP{str(index).zfill(5)}"
        
        # Take first letters of important words
        words = name.split()
        initials = ''
        
        for word in words[:3]:  # Take up to 3 words
            if word and len(word) > 0:
                initials += word[0].upper()
        
        if len(initials) < 2:
            initials = 'SUP'
        
        return f"{initials[:3]}{str(index).zfill(4)}"
    
    @staticmethod
    def normalize_phone(phone: Any) -> Optional[str]:
        """Normalize phone number format."""
        if not phone:
            return None
        
        # Remove non-numeric characters
        phone = re.sub(r'[^\d]', '', str(phone))
        
        # Check for valid Thai phone format
        if len(phone) == 10 and phone.startswith('0'):
            return phone
        elif len(phone) == 9 and phone.startswith('0'):
            return f"0{phone[1:]}"
        
        return phone if len(phone) >= 8 else None

# ==============================================================================
# Supplier Deduplication
# ==============================================================================

class SupplierDeduplicator:
    """Handles supplier deduplication."""
    
    @staticmethod
    def create_name_key(name: str) -> str:
        """Create a normalized key for comparison."""
        if not name:
            return ''
        
        # Convert to lowercase
        key = name.lower()
        
        # Remove common prefixes
        prefixes = ['บริษัท', 'บจก', 'บจ.', 'บ.จ.', 'ห้างหุ้นส่วน', 'หจ.', 'ห้าง', 'ร้าน', 'จำกัด']
        for prefix in prefixes:
            key = key.replace(prefix, '')
        
        # Remove whitespace and punctuation
        key = re.sub(r'[\s\.,\-()]', '', key)
        
        return key
    
    @staticmethod
    def find_duplicates(suppliers: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Find and merge duplicate suppliers."""
        seen = {}
        unique = []
        duplicates = []
        
        for supplier in suppliers:
            name = supplier.get('companyname', '') or supplier.get('name', '')
            key = SupplierDeduplicator.create_name_key(name)
            
            if key in seen:
                # Found duplicate
                duplicates.append({
                    'original': seen[key],
                    'duplicate': supplier,
                    'key': key
                })
            else:
                seen[key] = supplier
                unique.append(supplier)
        
        return unique, duplicates

# ==============================================================================
# Migration Statistics
# ==============================================================================

@dataclass
class MigrationStats:
    """Tracks migration statistics."""
    total_source_records: int = 0
    total_unique_suppliers: int = 0
    total_duplicates_found: int = 0
    total_imported: int = 0
    total_updated: int = 0
    total_skipped: int = 0
    total_errors: int = 0
    start_time: datetime = None
    end_time: datetime = None
    
    def duration_seconds(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0
    
    def to_dict(self) -> Dict:
        return {
            'total_source_records': self.total_source_records,
            'total_unique_suppliers': self.total_unique_suppliers,
            'total_duplicates_found': self.total_duplicates_found,
            'total_imported': self.total_imported,
            'total_updated': self.total_updated,
            'total_skipped': self.total_skipped,
            'total_errors': self.total_errors,
            'duration_seconds': self.duration_seconds(),
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None
        }

# ==============================================================================
# Main Migration Class
# ==============================================================================

class SupplierMigrator:
    """Main class for migrating supplier data."""
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or self._get_default_config_path()
        self.config = self._load_config()
        self.stats = MigrationStats()
        self.logger = setup_logger(
            self.config.get('logging', {}).get('log_dir', './logs/migration'),
            'suppliers'
        )
        
        self.source_db: Optional[DatabaseManager] = None
        self.target_db: Optional[DatabaseManager] = None
    
    def _get_default_config_path(self) -> str:
        script_dir = Path(__file__).parent
        return str(script_dir / "migration-config.json")
    
    def _load_config(self) -> Dict:
        """Load configuration from JSON file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            self.logger.error(f"Config file not found: {self.config_path}")
            raise
    
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
        """Fetch all unique suppliers from source database."""
        self.logger.info("Fetching supplier data from source...")
        
        # Get company names from drugstorereceive table
        query = """
            SELECT DISTINCT
                companyname,
                COUNT(*) as receive_count,
                MIN(receivedate) as first_receive,
                MAX(receivedate) as last_receive
            FROM drugstorereceive
            WHERE companyname IS NOT NULL
            AND companyname != ''
            AND companyname NOT IN ('NULL', 'N/A', '-')
            GROUP BY companyname
            ORDER BY receive_count DESC, companyname
        """
        
        with self.source_db.connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                records = cursor.fetchall()
                self.logger.info(f"Fetched {len(records)} unique supplier names from source")
                return list(records)
    
    def cleanse_data(self, records: List[Dict]) -> List[Dict]:
        """Cleanse and transform supplier data."""
        self.logger.info("Cleansing supplier data...")
        
        cleanser = SupplierCleanser()
        cleansed_records = []
        
        for idx, record in enumerate(records):
            company_name = cleanser.clean_company_name(record.get('companyname'))
            
            if not company_name:
                continue
            
            # Extract additional info
            info = cleanser.extract_supplier_info(company_name)
            
            # Generate supplier code
            supplier_code = cleanser.generate_supplier_code(company_name, idx + 1)
            
            cleansed = {
                'supplier_code': supplier_code,
                'supplier_name': company_name,
                'supplier_type': info['type'],
                'is_government': info['is_government'],
                'receive_count': int(record.get('receive_count', 0)),
                'first_receive_date': record.get('first_receive'),
                'last_receive_date': record.get('last_receive'),
                'contact_person': None,
                'phone': None,
                'email': None,
                'address': None,
                'tax_id': None,
                'payment_terms': None,
                'is_active': True,
                'notes': f"Migrated from JHCIS - {record.get('receive_count', 0)} receive transactions"
            }
            
            cleansed_records.append(cleansed)
        
        self.logger.info(f"Cleansed {len(cleansed_records)} supplier records")
        return cleansed_records
    
    def deduplicate_data(self, records: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Remove duplicate suppliers."""
        self.logger.info("Deduplicating supplier records...")
        
        unique, duplicates = SupplierDeduplicator.find_duplicates(records)
        
        self.stats.total_duplicates_found = len(duplicates)
        self.logger.info(f"Found {len(duplicates)} duplicates, {len(unique)} unique suppliers")
        
        return unique, duplicates
    
    def validate_data(self, records: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Validate supplier data."""
        self.logger.info("Validating supplier data...")
        
        valid_records = []
        invalid_records = []
        
        for record in records:
            issues = []
            
            # Check required fields
            if not record.get('supplier_name'):
                issues.append("Missing supplier name")
            
            if not record.get('supplier_code'):
                issues.append("Missing supplier code")
            
            # Check for invalid characters
            if record.get('supplier_name'):
                name = record['supplier_name']
                if len(name) > 255:
                    issues.append(f"Name too long: {len(name)} characters")
            
            if issues:
                invalid_records.append({
                    'record': record,
                    'issues': issues
                })
            else:
                valid_records.append(record)
        
        self.logger.info(f"Validation complete: {len(valid_records)} valid, {len(invalid_records)} invalid")
        return valid_records, invalid_records
    
    def ensure_target_tables(self):
        """Ensure target tables exist."""
        self.logger.info("Ensuring target tables exist...")
        
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS suppliers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            supplier_code VARCHAR(20) UNIQUE NOT NULL,
            supplier_name VARCHAR(255) NOT NULL,
            supplier_type ENUM('limited_company', 'partnership', 'shop', 'government', 'private', 'unknown') DEFAULT 'private',
            is_government BOOLEAN DEFAULT FALSE,
            contact_person VARCHAR(100),
            phone VARCHAR(20),
            email VARCHAR(100),
            address TEXT,
            tax_id VARCHAR(13),
            payment_terms VARCHAR(50),
            credit_limit DECIMAL(15,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_supplier_code (supplier_code),
            INDEX idx_supplier_name (supplier_name),
            INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        
        with self.target_db.connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(create_table_sql)
            conn.commit()
        
        self.logger.info("Target tables ready")
    
    def import_data(self, records: List[Dict]) -> bool:
        """Import supplier data to target database."""
        self.logger.info("Starting supplier import...")
        
        is_dry_run = self.config.get('migration', {}).get('dry_run', False)
        
        if is_dry_run:
            self.logger.info("DRY RUN MODE - No data will be written")
            self.stats.total_imported = len(records)
            return True
        
        imported = 0
        updated = 0
        errors = 0
        
        with self.target_db.connect() as conn:
            for record in records:
                try:
                    # Check if supplier exists
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "SELECT id FROM suppliers WHERE supplier_name = %s",
                            (record['supplier_name'],)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            # Update existing
                            update_sql = """
                                UPDATE suppliers SET
                                    supplier_type = %s,
                                    is_government = %s,
                                    is_active = %s,
                                    notes = %s,
                                    updated_at = NOW()
                                WHERE id = %s
                            """
                            cursor.execute(update_sql, (
                                record.get('supplier_type'),
                                record.get('is_government', False),
                                record.get('is_active', True),
                                record.get('notes'),
                                existing['id']
                            ))
                            updated += 1
                        else:
                            # Insert new
                            insert_sql = """
                                INSERT INTO suppliers (
                                    supplier_code, supplier_name, supplier_type,
                                    is_government, is_active, notes, created_at
                                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                            """
                            cursor.execute(insert_sql, (
                                record['supplier_code'],
                                record['supplier_name'],
                                record.get('supplier_type'),
                                record.get('is_government', False),
                                record.get('is_active', True),
                                record.get('notes')
                            ))
                            imported += 1
                
                except Exception as e:
                    errors += 1
                    self.logger.error(f"Error importing {record.get('supplier_name')}: {str(e)}")
            
            conn.commit()
        
        self.stats.total_imported = imported
        self.stats.total_updated = updated
        self.stats.total_errors = errors
        
        self.logger.info(f"Import complete: {imported} imported, {updated} updated, {errors} errors")
        return True
    
    def generate_report(self) -> Dict:
        """Generate migration report."""
        report = {
            'migration_type': 'Suppliers',
            'status': 'SUCCESS' if self.stats.total_errors == 0 else 'COMPLETED_WITH_ERRORS',
            'statistics': self.stats.to_dict(),
            'timestamp': datetime.now().isoformat()
        }
        
        # Save report
        report_dir = Path(self.config.get('logging', {}).get('log_dir', './logs/migration'))
        report_dir.mkdir(parents=True, exist_ok=True)
        
        report_file = report_dir / f"suppliers_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Report saved to: {report_file}")
        return report
    
    def run(self) -> bool:
        """Execute the full migration pipeline."""
        self.logger.info("=" * 60)
        self.logger.info("Starting Supplier Migration")
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
            self.stats.total_unique_suppliers = len(cleansed_records)
            
            # Deduplicate
            unique_records, duplicates = self.deduplicate_data(cleansed_records)
            self.stats.total_duplicates_found = len(duplicates)
            
            # Validate
            valid_records, invalid_records = self.validate_data(unique_records)
            
            # Ensure target tables
            self.ensure_target_tables()
            
            # Import
            success = self.import_data(valid_records)
            
            if not success:
                self.logger.error("Migration failed!")
                return False
            
            # Generate report
            report = self.generate_report()
            
            self.logger.info("=" * 60)
            self.logger.info("Supplier Migration Complete!")
            self.logger.info(f"Total source records: {self.stats.total_source_records}")
            self.logger.info(f"Unique suppliers: {self.stats.total_unique_suppliers}")
            self.logger.info(f"Duplicates found: {self.stats.total_duplicates_found}")
            self.logger.info(f"Suppliers imported: {self.stats.total_imported}")
            self.logger.info(f"Suppliers updated: {self.stats.total_updated}")
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
    
    parser = argparse.ArgumentParser(description='Migrate supplier data from JHCIS')
    parser.add_argument('--config', '-c', help='Path to configuration file', default=None)
    parser.add_argument('--dry-run', '-n', help='Dry run (no data written)', action='store_true')
    parser.add_argument('--verbose', '-v', help='Verbose output', action='store_true')
    
    args = parser.parse_args()
    
    migrator = SupplierMigrator(config_path=args.config)
    
    if args.dry_run:
        migrator.config['migration']['dry_run'] = True
        print("DRY RUN MODE ENABLED")
    
    success = migrator.run()
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()