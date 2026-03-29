#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data Migration Script: Initial Stock Levels
============================================

This script migrates initial stock level data from JHCIS (jhcisdb)
to the new Inventory & Procurement system.

Source Tables:
- cdrugremain (current stock levels)
- cdrug (for product mapping)

Target Tables:
- stock_levels
- stock_movements (initial adjustment)

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
import hashlib

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
    
    logger = logging.getLogger("stock_migration")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    
    fh = logging.FileHandler(log_file, encoding='utf-8')
    fh.setLevel(logging.DEBUG)
    
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    
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
# Data Cleansing
# ==============================================================================

class StockDataCleanser:
    """Handles stock data cleaning."""
    
    @staticmethod
    def clean_quantity(value: Any) -> int:
        """Clean and convert quantity to integer."""
        if value is None:
            return 0
        try:
            qty = int(float(value))
            return max(0, qty)  # Ensure non-negative
        except (ValueError, TypeError):
            return 0
    
    @staticmethod
    def clean_pcucode(value: Any) -> Optional[str]:
        """Clean PCU code."""
        if value is None:
            return None
        code = str(value).strip()
        return code if len(code) <= 10 else None
    
    @staticmethod
    def clean_drugcode(value: Any) -> Optional[str]:
        """Clean drug code."""
        if value is None:
            return None
        code = str(value).strip()
        return code if len(code) <= 24 else None
    
    @staticmethod
    def clean_requisition_flag(value: Any) -> str:
        """Clean requisition flag."""
        if value is None:
            return 'N'
        flag = str(value).strip().upper()
        return flag if flag in ['Y', 'N', '1', '0'] else 'N'

# ==============================================================================
# Validation
# ==============================================================================

class StockValidator:
    """Validates stock data."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.errors: List[Dict] = []
        self.warnings: List[Dict] = []
    
    def validate_stock_record(
        self,
        record: Dict,
        product_map: Dict[str, int]
    ) -> Tuple[bool, List[str]]:
        """Validate a single stock record."""
        issues = []
        
        # Check if product exists
        drugcode = record.get('drugcode')
        if not drugcode:
            issues.append("Missing drugcode")
        elif drugcode not in product_map:
            issues.append(f"Product not found in target: {drugcode}")
        
        # Validate quantity
        qty = StockDataCleanser.clean_quantity(record.get('remain'))
        if qty < 0:
            issues.append(f"Invalid quantity: {qty}")
        
        # Check PCU code
        pcucode = record.get('pcucode')
        if not pcucode:
            self.warnings.append({
                'drugcode': drugcode,
                'warning': 'Missing PCU code'
            })
        
        return (len(issues) == 0, issues)
    
    def get_summary(self) -> Dict:
        """Get validation summary."""
        return {
            'total_errors': len(self.errors),
            'total_warnings': len(self.warnings),
            'errors': self.errors[:100],
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
    total_products_mapped: int = 0
    total_stock_levels_created: int = 0
    total_stock_levels_updated: int = 0
    total_movements_created: int = 0
    total_zero_stock: int = 0
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
            'total_valid_records': self.total_valid_records,
            'total_invalid_records': self.total_invalid_records,
            'total_products_mapped': self.total_products_mapped,
            'total_stock_levels_created': self.total_stock_levels_created,
            'total_stock_levels_updated': self.total_stock_levels_updated,
            'total_movements_created': self.total_movements_created,
            'total_zero_stock': self.total_zero_stock,
            'total_errors': self.total_errors,
            'duration_seconds': self.duration_seconds(),
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None
        }

# ==============================================================================
# Main Migration Class
# ==============================================================================

class InitialStockMigrator:
    """Main class for migrating initial stock levels."""
    
    # Default location for initial stock
    DEFAULT_LOCATION_ID = 1
    DEFAULT_LOCATION_NAME = "คลังหลัก"
    
    # Movement type for initial adjustment
    MOVEMENT_TYPE_INITIAL = "initial"
    MOVEMENT_TYPE_ADJUSTMENT = "adjustment"
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or self._get_default_config_path()
        self.config = self._load_config()
        self.stats = MigrationStats()
        self.logger = setup_logger(
            self.config.get('logging', {}).get('log_dir', './logs/migration'),
            'initial_stock'
        )
        self.validator = StockValidator(self.logger)
        self.cleanser = StockDataCleanser()
        
        self.source_db: Optional[DatabaseManager] = None
        self.target_db: Optional[DatabaseManager] = None
        
        # Cache for product mapping
        self.product_map: Dict[str, int] = {}
    
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
        """Fetch stock level data from source."""
        self.logger.info("Fetching stock data from cdrugremain...")
        
        query = """
            SELECT 
                pcucode,
                drugcode,
                remain,
                requisition
            FROM cdrugremain
            ORDER BY drugcode
        """
        
        with self.source_db.connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                records = cursor.fetchall()
                self.logger.info(f"Fetched {len(records)} stock records from source")
                return list(records)
    
    def fetch_product_mapping(self) -> Dict[str, int]:
        """Fetch product code to ID mapping from target."""
        self.logger.info("Fetching product mapping from target...")
        
        query = "SELECT id, product_code FROM products WHERE is_active = 1"
        
        mapping = {}
        
        with self.target_db.connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                records = cursor.fetchall()
                
                for record in records:
                    product_code = record.get('product_code')
                    product_id = record.get('id')
                    if product_code and product_id:
                        mapping[product_code] = product_id
        
        self.logger.info(f"Loaded {len(mapping)} product mappings")
        self.stats.total_products_mapped = len(mapping)
        return mapping
    
    def ensure_locations(self) -> Dict[str, int]:
        """Ensure stock locations exist."""
        self.logger.info("Ensuring stock locations...")
        
        locations = {}
        
        # Check if default location exists
        check_query = "SELECT id, location_code FROM stock_locations WHERE id = %s"
        insert_query = """
            INSERT INTO stock_locations (location_code, location_name, location_type, is_active, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """
        
        with self.target_db.connect() as conn:
            with conn.cursor() as cursor:
                # Check for main warehouse
                cursor.execute(check_query, (self.DEFAULT_LOCATION_ID,))
                result = cursor.fetchone()
                
                if result:
                    locations['main'] = result['id']
                    self.logger.info(f"Location exists: {result['id']}")
                else:
                    # Create main warehouse
                    try:
                        cursor.execute(insert_query, (
                            'WH001',
                            self.DEFAULT_LOCATION_NAME,
                            'warehouse',
                            True
                        ))
                        conn.commit()
                        locations['main'] = cursor.lastrowid
                        self.logger.info(f"Created location: {cursor.lastrowid}")
                    except Exception as e:
                        self.logger.warning(f"Could not create location: {e}")
                        locations['main'] = self.DEFAULT_LOCATION_ID
        
        return locations
    
    def ensure_tables(self):
        """Ensure target tables exist."""
        self.logger.info("Ensuring target tables...")
        
        create_stock_levels = """
        CREATE TABLE IF NOT EXISTS stock_levels (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            location_id INT NOT NULL DEFAULT 1,
            quantity INT NOT NULL DEFAULT 0,
            reorder_point INT DEFAULT 0,
            max_stock INT DEFAULT 0,
            lot_number VARCHAR(50),
            expiry_date DATE,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_product_location (product_id, location_id),
            INDEX idx_product (product_id),
            INDEX idx_location (location_id),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        
        create_stock_movements = """
        CREATE TABLE IF NOT EXISTS stock_movements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            movement_no VARCHAR(50) NOT NULL,
            movement_type ENUM('initial', 'receive', 'issue', 'adjustment', 'transfer', 'return', 'damage') NOT NULL,
            product_id INT NOT NULL,
            location_id INT NOT NULL DEFAULT 1,
            quantity INT NOT NULL,
            movement_date DATE NOT NULL,
            reference_no VARCHAR(50),
            reference_type VARCHAR(20),
            lot_number VARCHAR(50),
            expiry_date DATE,
            unit_cost DECIMAL(15,2) DEFAULT 0,
            total_cost DECIMAL(15,2) DEFAULT 0,
            notes TEXT,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_movement_no (movement_no),
            INDEX idx_movement_type (movement_type),
            INDEX idx_product (product_id),
            INDEX idx_movement_date (movement_date),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        
        create_stock_locations = """
        CREATE TABLE IF NOT EXISTS stock_locations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            location_code VARCHAR(20) UNIQUE NOT NULL,
            location_name VARCHAR(100) NOT NULL,
            location_type ENUM('warehouse', 'pharmacy', 'clinic', 'other') DEFAULT 'warehouse',
            parent_id INT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_location_code (location_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        
        with self.target_db.connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(create_stock_locations)
                cursor.execute(create_stock_levels)
                cursor.execute(create_stock_movements)
            conn.commit()
        
        self.logger.info("Target tables ready")
    
    def cleanse_data(self, records: List[Dict]) -> List[Dict]:
        """Cleanse stock data."""
        self.logger.info("Cleansing stock data...")
        
        cleansed_records = []
        seen = set()
        duplicates = 0
        
        for record in records:
            # Create unique key
            drugcode = self.cleanser.clean_drugcode(record.get('drugcode'))
            pcucode = self.cleanser.clean_pcucode(record.get('pcucode'))
            
            if not drugcode:
                continue
            
            # Deduplicate
            key = f"{drugcode}|{pcucode or 'default'}"
            if key in seen:
                duplicates += 1
                continue
            seen.add(key)
            
            cleansed = {
                'drugcode': drugcode,
                'pcucode': pcucode,
                'quantity': self.cleanser.clean_quantity(record.get('remain')),
                'requisition': self.cleanser.clean_requisition_flag(record.get('requisition'))
            }
            
            cleansed_records.append(cleansed)
        
        self.logger.info(f"Cleansed {len(cleansed_records)} records, removed {duplicates} duplicates")
        return cleansed_records
    
    def validate_data(
        self,
        records: List[Dict],
        product_map: Dict[str, int]
    ) -> Tuple[List[Dict], List[Dict]]:
        """Validate stock records."""
        self.logger.info("Validating stock data...")
        
        valid_records = []
        invalid_records = []
        
        for record in records:
            is_valid, issues = self.validator.validate_stock_record(record, product_map)
            
            if is_valid:
                valid_records.append(record)
            else:
                invalid_records.append({
                    'record': record,
                    'issues': issues
                })
                self.stats.total_invalid_records += 1
        
        self.stats.total_valid_records = len(valid_records)
        self.logger.info(f"Validation: {len(valid_records)} valid, {len(invalid_records)} invalid")
        
        return valid_records, invalid_records
    
    def import_data(
        self,
        records: List[Dict],
        product_map: Dict[str, int],
        location_map: Dict[str, int]
    ) -> bool:
        """Import stock levels and create initial movements."""
        self.logger.info("Starting stock import...")
        
        is_dry_run = self.config.get('migration', {}).get('dry_run', False)
        
        if is_dry_run:
            self.logger.info("DRY RUN MODE - No data will be written")
            self.stats.total_stock_levels_created = len(records)
            self.stats.total_movements_created = len(records)
            return True
        
        # Generate movement number
        movement_no = f"INIT-{datetime.now().strftime('%Y%m%d')}-{datetime.now().strftime('%H%M%S')}"
        movement_date = datetime.now().strftime('%Y-%m-%d')
        location_id = location_map.get('main', self.DEFAULT_LOCATION_ID)
        
        stock_created = 0
        stock_updated = 0
        movements_created = 0
        zero_stock = 0
        errors = 0
        
        with self.target_db.connect() as conn:
            for record in records:
                try:
                    drugcode = record['drugcode']
                    product_id = product_map.get(drugcode)
                    quantity = record['quantity']
                    
                    if not product_id:
                        self.logger.warning(f"Product not found: {drugcode}")
                        continue
                    
                    # Skip zero stock (optional)
                    if quantity == 0:
                        zero_stock += 1
                        # Still create stock level record with 0
                        pass
                    
                    # Check if stock level exists
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "SELECT id FROM stock_levels WHERE product_id = %s AND location_id = %s",
                            (product_id, location_id)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            # Update existing
                            cursor.execute("""
                                UPDATE stock_levels SET
                                    quantity = %s,
                                    last_updated = NOW()
                                WHERE id = %s
                            """, (quantity, existing['id']))
                            stock_updated += 1
                        else:
                            # Create new
                            cursor.execute("""
                                INSERT INTO stock_levels (
                                    product_id, location_id, quantity, last_updated
                                ) VALUES (%s, %s, %s, NOW())
                            """, (product_id, location_id, quantity))
                            stock_created += 1
                        
                        # Create initial movement record
                        cursor.execute("""
                            INSERT INTO stock_movements (
                                movement_no, movement_type, product_id, location_id,
                                quantity, movement_date, reference_type, notes, created_at
                            ) VALUES (%s, 'initial', %s, %s, %s, %s, 'migration', %s, NOW())
                        """, (
                            movement_no,
                            product_id,
                            location_id,
                            quantity,
                            movement_date,
                            f"Initial stock from JHCIS migration - PCU: {record.get('pcucode', 'N/A')}"
                        ))
                        movements_created += 1
                
                except Exception as e:
                    errors += 1
                    self.logger.error(f"Error importing {record.get('drugcode')}: {str(e)}")
            
            conn.commit()
        
        self.stats.total_stock_levels_created = stock_created
        self.stats.total_stock_levels_updated = stock_updated
        self.stats.total_movements_created = movements_created
        self.stats.total_zero_stock = zero_stock
        self.stats.total_errors = errors
        
        self.logger.info(f"Import complete: {stock_created} created, {stock_updated} updated, {movements_created} movements")
        return True
    
    def generate_report(self) -> Dict:
        """Generate migration report."""
        report = {
            'migration_type': 'Initial Stock Levels',
            'status': 'SUCCESS' if self.stats.total_errors == 0 else 'COMPLETED_WITH_ERRORS',
            'statistics': self.stats.to_dict(),
            'validation_summary': self.validator.get_summary(),
            'timestamp': datetime.now().isoformat()
        }
        
        # Save report
        report_dir = Path(self.config.get('logging', {}).get('log_dir', './logs/migration'))
        report_dir.mkdir(parents=True, exist_ok=True)
        
        report_file = report_dir / f"initial_stock_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Report saved to: {report_file}")
        
        # Also save failed records if any
        failed_records_file = report_dir / f"failed_stock_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        if self.stats.total_invalid_records > 0:
            with open(failed_records_file, 'w', encoding='utf-8') as f:
                json.dump(self.validator.errors, f, indent=2, ensure_ascii=False)
            self.logger.info(f"Failed records saved to: {failed_records_file}")
        
        return report
    
    def run(self) -> bool:
        """Execute the full migration pipeline."""
        self.logger.info("=" * 60)
        self.logger.info("Starting Initial Stock Migration")
        self.logger.info("=" * 60)
        
        self.stats.start_time = datetime.now()
        
        try:
            # Connect databases
            self.connect_databases()
            
            # Ensure tables exist
            self.ensure_tables()
            
            # Fetch product mapping
            self.product_map = self.fetch_product_mapping()
            
            if not self.product_map:
                self.logger.error("No products found in target database!")
                self.logger.error("Please run master data migration first.")
                return False
            
            # Ensure locations
            location_map = self.ensure_locations()
            
            # Fetch source data
            source_records = self.fetch_source_data()
            self.stats.total_source_records = len(source_records)
            
            # Cleanse data
            cleansed_records = self.cleanse_data(source_records)
            
            # Validate data
            if self.config.get('migration', {}).get('validate_before_import', True):
                valid_records, invalid_records = self.validate_data(
                    cleansed_records, self.product_map
                )
            else:
                valid_records = cleansed_records
            
            # Import data
            success = self.import_data(valid_records, self.product_map, location_map)
            
            if not success:
                self.logger.error("Migration failed!")
                return False
            
            # Generate report
            report = self.generate_report()
            
            self.logger.info("=" * 60)
            self.logger.info("Initial Stock Migration Complete!")
            self.logger.info(f"Total source records: {self.stats.total_source_records}")
            self.logger.info(f"Products mapped: {self.stats.total_products_mapped}")
            self.logger.info(f"Stock levels created: {self.stats.total_stock_levels_created}")
            self.logger.info(f"Stock levels updated: {self.stats.total_stock_levels_updated}")
            self.logger.info(f"Movements created: {self.stats.total_movements_created}")
            self.logger.info(f"Zero stock records: {self.stats.total_zero_stock}")
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
    
    parser = argparse.ArgumentParser(description='Migrate initial stock levels from JHCIS')
    parser.add_argument('--config', '-c', help='Path to configuration file', default=None)
    parser.add_argument('--dry-run', '-n', help='Dry run (no data written)', action='store_true')
    parser.add_argument('--verbose', '-v', help='Verbose output', action='store_true')
    
    args = parser.parse_args()
    
    migrator = InitialStockMigrator(config_path=args.config)
    
    if args.dry_run:
        migrator.config['migration']['dry_run'] = True
        print("DRY RUN MODE ENABLED")
    
    success = migrator.run()
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()