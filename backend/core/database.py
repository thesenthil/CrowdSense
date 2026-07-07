import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

def get_db():
    """Returns the MongoDB database instance."""
    if not MONGO_URI:
        print("Warning: MONGO_URI not found in environment variables.")
        return None
    
    try:
        # Use certifi for SSL certificate verification (fixes common Atlas connection issues)
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client.omnisense  # Database name
        # Quick test connection
        client.admin.command('ping')
        return db
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None

def init_db():
    """Initializes collections and indexes (optional for MongoDB, but good practice)."""
    db = get_db()
    if db is not None:
        print("MongoDB Connected Successfully!")
        # Create indexes if they don't exist
        db.crowd_metrics.create_index("timestamp")
        db.ad_logs.create_index("timestamp")
        db.anomalies.create_index("timestamp")
        return True
    return False

# Initialize database module
db = get_db()
