from pymongo import MongoClient
from bcrypt import hashpw, gensalt

# --- THE FIX IS HERE ---
# Changed the MONGO_URI to connect to your local database
MONGO_URI = "mongodb://localhost:27017/crowd_management_db"

# --- Admin User Details ---
# You can change these details
ADMIN_USERNAME = "a"
ADMIN_PASSWORD = "a"

def add_admin():
    """Connects to the LOCAL MongoDB and adds or updates the admin user."""
    client = None
    try:
        print("Connecting to LOCAL MongoDB...")
        client = MongoClient(MONGO_URI)
        # Select the database
        db = client.crowd_management_db
        # Select the collection
        users_collection = db.users
        print("[SUCCESS] Connection successful.")

        # Check if the admin user already exists
        existing_user = users_collection.find_one({'username': ADMIN_USERNAME})

        # Hash the password
        hashed_password = hashpw(ADMIN_PASSWORD.encode('utf-8'), gensalt())

        if existing_user:
            print(f"User '{ADMIN_USERNAME}' already exists. Updating password...")
            users_collection.update_one(
                {'username': ADMIN_USERNAME},
                {'$set': {'password': hashed_password}}
            )
            print("[SUCCESS] Admin user password updated successfully.")
        else:
            print(f"User '{ADMIN_USERNAME}' not found. Creating new admin user...")
            users_collection.insert_one({
                'username': ADMIN_USERNAME,
                'password': hashed_password
            })
            print("[SUCCESS] Admin user created successfully.")

    except Exception as e:
        print(f"[ERROR] An error occurred: {e}")
    finally:
        if client is not None:
            client.close()
            print("Connection closed.")

if __name__ == '__main__':
    add_admin()