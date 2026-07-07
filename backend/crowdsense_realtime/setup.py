#!/usr/bin/env python3
"""
Setup script for Crowd Management System
This script helps set up the environment and run the application.
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages from requirements.txt"""
    print("Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Requirements installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing requirements: {e}")
        return False

def setup_admin_user():
    """Set up admin user in MongoDB"""
    print("Setting up admin user...")
    try:
        subprocess.check_call([sys.executable, "add_admin_user.py"])
        print("✅ Admin user setup completed!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error setting up admin user: {e}")
        return False

def check_mongodb():
    """Check if MongoDB is running"""
    print("Checking MongoDB connection...")
    try:
        import pymongo
        client = pymongo.MongoClient("mongodb://localhost:27017/")
        client.server_info()
        print("✅ MongoDB is running!")
        return True
    except Exception as e:
        print(f"❌ MongoDB is not running or not accessible: {e}")
        print("Please make sure MongoDB is installed and running on localhost:27017")
        return False

def main():
    print("🚀 Crowd Management System Setup")
    print("=" * 40)
    
    # Check MongoDB first
    if not check_mongodb():
        print("\n⚠️  Please start MongoDB before continuing.")
        print("   On Windows: Start MongoDB service or run 'mongod'")
        print("   On Linux/Mac: Run 'sudo systemctl start mongod' or 'mongod'")
        return
    
    # Install requirements
    if not install_requirements():
        print("\n❌ Failed to install requirements. Please check the error above.")
        return
    
    # Setup admin user
    if not setup_admin_user():
        print("\n❌ Failed to setup admin user. Please check the error above.")
        return
    
    print("\n✅ Setup completed successfully!")
    print("\nTo run the application:")
    print("   python app.py")
    print("\nThen open your browser and go to: http://localhost:5000")
    print("\nDefault admin credentials:")
    print("   Username: aditya")
    print("   Password: aditya@123")

if __name__ == "__main__":
    main()


