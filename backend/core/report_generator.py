import os
import google.generativeai as genai
from core.database import db
from datetime import datetime, timedelta

# Try to load API key from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None
    print("Warning: GEMINI_API_KEY is not set. LLM Reports will be disabled.")

def generate_daily_report():
    """Fetches the last 24 hours of data from MongoDB and generates an LLM report."""
    if not model or not db:
        return {"error": "Database or LLM not configured."}

    # Calculate time threshold (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    
    # 1. Fetch Crowd Metrics
    metrics_cursor = db.crowd_metrics.find({"timestamp": {"$gte": yesterday}})
    total_metrics = list(metrics_cursor)
    peak_crowd = max([m.get("total", 0) for m in total_metrics]) if total_metrics else 0
    
    # 2. Fetch Anomalies/Panics
    anomalies_cursor = db.anomalies.find({"timestamp": {"$gte": yesterday}})
    anomalies = list(anomalies_cursor)
    
    # 3. Fetch Ad Logs
    ads_cursor = db.ad_logs.find({"timestamp": {"$gte": yesterday}})
    ads = list(ads_cursor)
    
    # Construct the data summary prompt
    prompt = f"""
    You are OmniSense AI, an intelligent venue monitoring system. Generate a professional, 
    concise daily executive summary report for venue management based on the following data 
    from the last 24 hours:
    
    - Peak Crowd Density: {peak_crowd} people
    - Total Analytics Data Points Collected: {len(total_metrics)}
    - Security/Panic Anomalies Detected: {len(anomalies)}
    - Smart Ads Served: {len(ads)}
    
    Please provide:
    1. A brief executive summary (2-3 sentences).
    2. A bulleted list of key operational insights.
    3. Actionable recommendations for the next 24 hours regarding security and ad targeting.
    
    Format the output in clean Markdown.
    """
    
    try:
        response = model.generate_content(prompt)
        return {"success": True, "report": response.text}
    except Exception as e:
        print(f"Error generating LLM report: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Test script locally
    print("Generating report...")
    res = generate_daily_report()
    if res.get("success"):
        print("\n--- OMNISENSE DAILY REPORT ---\n")
        print(res["report"])
    else:
        print(res)
