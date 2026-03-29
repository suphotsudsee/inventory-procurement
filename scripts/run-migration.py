#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migration Runner - Run all migrations in correct order
=======================================================

This script orchestrates all migration scripts in the correct sequence:
1. Master Data (Products/Categories)
2. Suppliers
3. Initial Stock Levels

Author: Data Engineer
Date: 2026-03-29
"""

import subprocess
import sys
import os
from datetime import datetime
from pathlib import Path

def run_command(cmd: list, description: str) -> tuple:
    """Run a command and return success status."""
    print(f"\n{'='*60}")
    print(f"Starting: {description}")
    print(f"{'='*60}")
    
    start_time = datetime.now()
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Print output
        if result.stdout:
            print(result.stdout)
        
        if result.returncode != 0:
            print(f"\n[ERROR] {description} failed with exit code {result.returncode}")
            if result.stderr:
                print(f"Error output:\n{result.stderr}")
            return (False, duration)
        
        print(f"\n[SUCCESS] {description} completed in {duration:.2f} seconds")
        return (True, duration)
        
    except Exception as e:
        print(f"\n[EXCEPTION] {description} failed: {str(e)}")
        return (False, 0)

def main():
    """Main entry point."""
    print("="*60)
    print("MIGRATION RUNNER")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    script_dir = Path(__file__).parent
    
    # Parse arguments
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    config_path = None
    
    for i, arg in enumerate(sys.argv):
        if arg in ['-c', '--config'] and i + 1 < len(sys.argv):
            config_path = sys.argv[i + 1]
            break
    
    # Build base command
    base_cmd = [sys.executable]
    
    # Migration steps
    migrations = [
        {
            'script': 'migrate-master-data.py',
            'description': 'Master Data Migration (Products/Categories)',
            'required': True
        },
        {
            'script': 'migrate-suppliers.py',
            'description': 'Suppliers Migration',
            'required': False  # Can run independently
        },
        {
            'script': 'migrate-initial-stock.py',
            'description': 'Initial Stock Levels Migration',
            'required': True,
            'depends_on': ['migrate-master-data.py']  # Must run after master data
        }
    ]
    
    results = {}
    total_duration = 0
    all_success = True
    
    for migration in migrations:
        script_path = script_dir / migration['script']
        
        if not script_path.exists():
            print(f"\n[WARNING] Script not found: {script_path}")
            if migration['required']:
                print(f"[ERROR] Required script missing: {migration['script']}")
                all_success = False
                break
            continue
        
        # Build command
        cmd = base_cmd + [str(script_path)]
        
        if config_path:
            cmd.extend(['-c', config_path])
        
        if dry_run:
            cmd.append('--dry-run')
        
        if verbose:
            cmd.append('--verbose')
        
        # Run migration
        success, duration = run_command(cmd, migration['description'])
        
        results[migration['script']] = {
            'success': success,
            'duration': duration
        }
        
        total_duration += duration
        
        if not success and migration['required']:
            print(f"\n[ERROR] Required migration failed: {migration['script']}")
            all_success = False
            break
    
    # Print summary
    print("\n" + "="*60)
    print("MIGRATION SUMMARY")
    print("="*60)
    
    for script, result in results.items():
        status = "✓ PASSED" if result['success'] else "✗ FAILED"
        print(f"{script}: {status} ({result['duration']:.2f}s)")
    
    print(f"\nTotal duration: {total_duration:.2f}s")
    print(f"Overall status: {'SUCCESS' if all_success else 'FAILED'}")
    
    if dry_run:
        print("\n[NOTE] Dry run mode - No data was actually written")
    
    print("="*60)
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    return 0 if all_success else 1

if __name__ == '__main__':
    sys.exit(main())