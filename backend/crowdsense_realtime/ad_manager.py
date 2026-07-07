"""
Mall-Style Advertisement System
Real male/female accessories: shoes, pants, shirts, bags, jewelry, etc.
"""
import os
import random
import time
import threading
from datetime import datetime
import config

class AdManager:
    """Manages mall-style accessory advertisements"""
    
    def __init__(self, mongo_db=None):
        self.current_ad = None
        self.ad_start_time = None
        self.last_majority_gender = None
        self.ad_lock = threading.Lock()
        self.last_ad_change_time = {}
        self.ad_history = []  # Reset to empty on each restart
        self.mongo_db = mongo_db  # MongoDB database for analytics
        # Fallback: Store analytics in memory if MongoDB not available
        self.local_analytics = {}  # Reset to empty on each restart
        
        # Check MongoDB connection
        if self.mongo_db is not None:
            try:
                self.mongo_db.ad_analytics.find_one()
            except Exception as e:
                self.mongo_db = None
        
        # MALE ACCESSORIES ADS - Real Mall Products with Unique IDs
        # Shoes, Pants, Shirts, Watches, etc.
        self.demo_male_ads = [
            {
                'id': 'MALE_001',
                'path': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
                'type': 'image',
                'name': 'Men\'s Premium Shoes Collection',
                'description': 'Sports shoes, formal shoes, sneakers - Up to 50% OFF'
            },
            {
                'id': 'MALE_002',
                'path': 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
                'type': 'image',
                'name': 'Men\'s Fashion Pants & Jeans',
                'description': 'Denim, chinos, formal trousers - Latest styles'
            },
            {
                'id': 'MALE_003',
                'path': 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8TWVuJTVDJ3MlMjBTaGlydHMlMjAlMjYlMjBULVNoaXJ0c3xlbnwwfHwwfHx8MA%3D%3D&fm=jpg&q=60&w=3000',
                'type': 'image',
                'name': 'Men\'s Shirts & T-Shirts',
                'description': 'Casual shirts, formal shirts, polo tees - All sizes available'
            },
            {
                'id': 'MALE_004',
                'path': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
                'type': 'image',
                'name': 'Men\'s Watches & Accessories',
                'description': 'Premium watches, belts, wallets - Luxury collection'
            }
        ]
        
        # FEMALE ACCESSORIES ADS - Real Mall Products with Unique IDs
        # Handbags, Jewelry, Shoes, Cosmetics, etc.
        self.demo_female_ads = [
            {
                'id': 'FEMALE_001',
                'path': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',
                'type': 'image',
                'name': 'Women\'s Handbags & Purses',
                'description': 'Designer bags, clutches, totes - Fashion collection'
            },
            {
                'id': 'FEMALE_002',
                'path': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800',
                'type': 'image',
                'name': 'Women\'s Jewelry Collection',
                'description': 'Necklaces, earrings, bracelets - Elegant pieces'
            },
            {
                'id': 'FEMALE_003',
                'path': 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800',
                'type': 'image',
                'name': 'Women\'s Footwear',
                'description': 'Heels, flats, sandals, boots - Latest trends'
            },
            {
                'id': 'FEMALE_004',
                'path': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800',
                'type': 'image',
                'name': 'Beauty & Cosmetics',
                'description': 'Makeup, skincare, perfumes - Premium brands'
            },
            {
                'id': 'FEMALE_005',
                'path': 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800',
                'type': 'image',
                'name': 'Women\'s Fashion Accessories',
                'description': 'Scarves, sunglasses, fashion jewelry - Complete collection'
            }
        ]
        
        # NEUTRAL/GENERAL MALL ADS with Unique IDs
        self.demo_neutral_ads = [
            {
                'id': 'NEUTRAL_001',
                'path': 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800',
                'type': 'image',
                'name': 'Mall Special Promotions',
                'description': 'Weekend sales, special discounts - Shop now!'
            },
            {
                'id': 'NEUTRAL_002',
                'path': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
                'type': 'image',
                'name': 'Food Court Offers',
                'description': 'Special meals, discounts on dining - Visit now!'
            }
        ]
        
        # Load local ads if available
        self.male_ads = []
        self.female_ads = []
        self.neutral_ads = []
        self.ads_dir = config.ADS_DIR
        self._load_ads()
        
        # Use demo ads if no local files
        if not self.male_ads:
            self.male_ads = self.demo_male_ads
        if not self.female_ads:
            self.female_ads = self.demo_female_ads
        if not self.neutral_ads:
            self.neutral_ads = self.demo_neutral_ads
    
    def _load_ads(self):
        """Load local ad files"""
        try:
            if os.path.exists(self.ads_dir):
                for gender_dir in ['male', 'female', 'neutral']:
                    gender_path = os.path.join(self.ads_dir, gender_dir)
                    if os.path.exists(gender_path):
                        ads = []
                        for file in os.listdir(gender_path):
                            if file.startswith('.') or file.lower().endswith(('.txt', '.md')):
                                continue
                            if file.lower().endswith(('.mp4', '.webm', '.jpg', '.jpeg', '.png', '.gif')):
                                # Generate unique ID based on gender and filename
                                ad_id = f"{gender_dir.upper()}_{file.replace('.', '_').replace(' ', '_').upper()}"
                                ads.append({
                                    'id': ad_id,
                                    'path': f'/static/ads/{gender_dir}/{file}',
                                    'type': 'video' if file.lower().endswith(('.mp4', '.webm')) else 'image',
                                    'name': file.replace('_', ' ').replace('.mp4', '').replace('.webm', '').replace('.jpg', '').title()
                                })
                        if gender_dir == 'male':
                            self.male_ads = ads
                        elif gender_dir == 'female':
                            self.female_ads = ads
                        else:
                            self.neutral_ads = ads
            else:
                os.makedirs(os.path.join(self.ads_dir, 'male'), exist_ok=True)
                os.makedirs(os.path.join(self.ads_dir, 'female'), exist_ok=True)
                os.makedirs(os.path.join(self.ads_dir, 'neutral'), exist_ok=True)
        except Exception as e:
            pass
    
    def should_show_ad(self, gender, counts):
        """AUTOMATIC ad display - shows based on gender majority automatically"""
        with self.ad_lock:
            current_time = time.time()
            
            total = counts.get('total', 0)
            male = counts.get('male', 0)
            female = counts.get('female', 0)
            
            # Only show if people detected
            if total == 0:
                return False, None
            
            # If ad is currently showing, check if we should switch
            if self.current_ad and self.ad_start_time:
                elapsed = current_time - self.ad_start_time
                
                # If current ad duration not finished AND gender hasn't changed, keep showing
                if elapsed < config.AD_DISPLAY_DURATION:
                    # BUT: Switch immediately if majority gender changed
                    if gender != self.last_majority_gender:
                        return True, gender
                    return False, self.current_ad
            
            # Check time since last ad change
            if gender in self.last_ad_change_time:
                time_since = current_time - self.last_ad_change_time[gender]
                if time_since < config.AD_TRIGGER_DELAY:
                    return False, None
            
            # AUTOMATIC: Show ad for detected gender
            return True, gender
    
    def select_ad(self, gender):
        """Select ad for gender - ALWAYS returns an ad and tracks display count"""
        with self.ad_lock:
            ads_list = []
            if gender == 'male':
                ads_list = self.male_ads if self.male_ads else self.demo_male_ads
            elif gender == 'female':
                ads_list = self.female_ads if self.female_ads else self.demo_female_ads
            else:
                ads_list = self.neutral_ads if self.neutral_ads else self.demo_neutral_ads
            
            if not ads_list:
                ads_list = self.demo_neutral_ads
            
            selected = random.choice(ads_list)
            
            # Ensure ad has an ID - create unique ID for each ad
            if 'id' not in selected:
                # Create unique ID based on gender and ad name
                ad_name_clean = selected.get('name', 'UNKNOWN').replace(' ', '_').replace("'", '').upper()
                selected['id'] = f"{gender.upper()}_{ad_name_clean}"
            
            self.current_ad = {
                **selected,
                'gender': gender,
                'timestamp': datetime.now().isoformat()
            }
            self.ad_start_time = time.time()
            self.last_ad_change_time[gender] = time.time()
            self.last_majority_gender = gender  # Track majority
            
            # Track ad display in MongoDB - IMPORTANT: Track every time ad is selected
            try:
                self._track_ad_display(self.current_ad)
            except Exception as e:
                # Log error but don't break ad selection
                print(f"[Ad Tracking Error] {e}")
            
            self.ad_history.append({
                'ad': self.current_ad,
                'timestamp': datetime.now().isoformat()
            })
            
            if len(self.ad_history) > 100:
                self.ad_history.pop(0)
            
            return self.current_ad
    
    def _track_ad_display(self, ad):
        """Track ad display count in MongoDB (with fallback to memory)"""
        try:
            ad_id = ad.get('id', 'UNKNOWN')
            gender = ad.get('gender', 'neutral')
            
            # Try MongoDB first
            if self.mongo_db is not None:
                try:
                    result = self.mongo_db.ad_analytics.update_one(
                        {'ad_id': ad_id},
                        {
                            '$inc': {'display_count': 1},
                            '$set': {
                                'ad_name': ad.get('name', 'Unknown'),
                                'ad_path': ad.get('path', ''),
                                'ad_type': ad.get('type', 'image'),
                                'gender': gender,
                                'last_displayed': datetime.now().isoformat()
                            },
                            '$setOnInsert': {
                                'created_at': datetime.now().isoformat()
                            }
                        },
                        upsert=True
                    )
                    return
                except Exception as mongo_error:
                    pass
            
            # Fallback: Track in memory
            if ad_id not in self.local_analytics:
                self.local_analytics[ad_id] = {
                    'ad_id': ad_id,
                    'ad_name': ad.get('name', 'Unknown'),
                    'ad_path': ad.get('path', ''),
                    'ad_type': ad.get('type', 'image'),
                    'gender': gender,
                    'display_count': 0,
                    'last_displayed': datetime.now().isoformat(),
                    'created_at': datetime.now().isoformat()
                }
            
            self.local_analytics[ad_id]['display_count'] = self.local_analytics[ad_id].get('display_count', 0) + 1
            self.local_analytics[ad_id]['last_displayed'] = datetime.now().isoformat()
            
        except Exception as e:
            pass
    
    def get_current_ad(self):
        """Get currently displayed ad"""
        with self.ad_lock:
            if self.current_ad and self.ad_start_time:
                elapsed = time.time() - self.ad_start_time
                if elapsed < config.AD_DISPLAY_DURATION:
                    return self.current_ad
                else:
                    self.current_ad = None
                    self.ad_start_time = None
            return self.current_ad
    
    def clear_ad(self):
        """Clear current ad"""
        with self.ad_lock:
            self.current_ad = None
            self.ad_start_time = None
    
    def get_ad_history(self, limit=20):
        """Get recent ad display history"""
        return self.ad_history[-limit:]
    
    def get_stats(self):
        """Get ad display statistics"""
        with self.ad_lock:
            # Count ads by gender - handle both lowercase and uppercase gender strings
            male_count = sum(1 for h in self.ad_history if h['ad'].get('gender', '').lower() == 'male')
            female_count = sum(1 for h in self.ad_history if h['ad'].get('gender', '').lower() == 'female')
            
            stats = {
                'total_ads_shown': len(self.ad_history),
                'male_ads_shown': male_count,
                'female_ads_shown': female_count,
                'available_male_ads': len(self.male_ads),
                'available_female_ads': len(self.female_ads),
                'available_neutral_ads': len(self.neutral_ads),
                'current_ad': self.current_ad
            }
            return stats
    
    def get_ad_analytics(self):
        """Get detailed ad analytics from MongoDB (with fallback to memory)"""
        try:
            # Try MongoDB first
            mongo_ads = []
            if self.mongo_db:
                try:
                    mongo_ads = list(self.mongo_db.ad_analytics.find())
                except Exception as e:
                    print(f"[Ad Analytics] MongoDB read error: {e}")
            
            # Merge MongoDB data with local memory data
            all_ads_dict = {}
            
            # Add MongoDB ads
            for ad in mongo_ads:
                ad_id = ad.get('ad_id', 'UNKNOWN')
                all_ads_dict[ad_id] = dict(ad)
            
            # Add/update with local memory ads (local takes priority for counts)
            for ad_id, ad_data in self.local_analytics.items():
                if ad_id in all_ads_dict:
                    # Merge: use local count if higher, or add them together
                    all_ads_dict[ad_id]['display_count'] = max(
                        all_ads_dict[ad_id].get('display_count', 0),
                        ad_data.get('display_count', 0)
                    )
                else:
                    all_ads_dict[ad_id] = dict(ad_data)
            
            # Convert to list and group by gender
            all_ads_list = list(all_ads_dict.values())
            male_ads = [ad for ad in all_ads_list if ad.get('gender', '').lower() == 'male']
            female_ads = [ad for ad in all_ads_list if ad.get('gender', '').lower() == 'female']
            neutral_ads = [ad for ad in all_ads_list if ad.get('gender', '').lower() == 'neutral']
            
            # Sort by display count
            male_ads.sort(key=lambda x: x.get('display_count', 0), reverse=True)
            female_ads.sort(key=lambda x: x.get('display_count', 0), reverse=True)
            neutral_ads.sort(key=lambda x: x.get('display_count', 0), reverse=True)
            
            # Calculate totals - ensure we have numbers, not None
            total_displays = sum(ad.get('display_count', 0) or 0 for ad in all_ads_list)
            male_total = sum(ad.get('display_count', 0) or 0 for ad in male_ads)
            female_total = sum(ad.get('display_count', 0) or 0 for ad in female_ads)
            
            # Get most displayed ads (top 10)
            most_displayed = sorted(all_ads_list, key=lambda x: x.get('display_count', 0), reverse=True)[:10]
            
            # Ensure display_count is set for all ads
            for ad in male_ads + female_ads + neutral_ads + most_displayed:
                if 'display_count' not in ad or ad['display_count'] is None:
                    ad['display_count'] = 0
            
            return {
                'male_ads': male_ads,
                'female_ads': female_ads,
                'neutral_ads': neutral_ads,
                'total_displays': total_displays,
                'male_total': male_total,
                'female_total': female_total,
                'most_displayed': most_displayed
            }
        except Exception as e:
            return {
                'male_ads': [],
                'female_ads': [],
                'neutral_ads': [],
                'total_displays': 0,
                'male_total': 0,
                'female_total': 0,
                'most_displayed': []
            }
