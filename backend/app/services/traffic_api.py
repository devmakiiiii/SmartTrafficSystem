"""
Real Traffic API Integration
============================
Integrates with free MMDA Traffic API to fetch live traffic data.
Falls back to simulation when API is unavailable.

MMDA Traffic API (community-provided, no API key required)
Based on: https://github.com/ridvanbaluyos/traffic-api
Endpoint: http://traffic.gundamserver.com/v1/feed
"""

import httpx
from typing import Dict, List, Optional

# MMDA Traffic API endpoint (free community service)
MMDA_TRAFFIC_URL = "http://traffic.gundamserver.com/v1/feed"

async def fetch_real_traffic() -> Optional[List[Dict]]:
    """
    Fetch real traffic flow data from MMDA API for Metro Manila.
    Returns list of highway segments with traffic status or None if unavailable.
    No API key required - uses free community endpoint.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(MMDA_TRAFFIC_URL)
            response.raise_for_status()
            data = response.json()
            
            # Parse MMDA response to our format
            return _parse_mmda_response(data)
    except Exception:
        return None

def _parse_mmda_response(data: dict) -> List[Dict]:
    """
    Parse MMDA Traffic API response to intersection-compatible format.
    
    MMDA API returns traffic status per highway/segment with:
    - CF: Current Flow (1=light, 2=moderate, 3=heavy, 4=slow)
    - Roads like EDSA, Commonwealth, etc.
    """
    results = []
    
    # Map MMDA roads to approximate EDSA corridor coordinates
    edsa_coordinates = [
        {"lat": 14.5587, "lng": 121.0234, "name": "EDSA & Roxas Boulevard"},
        {"lat": 14.5551, "lng": 121.0244, "name": "EDSA & Ayala Avenue"},
        {"lat": 14.5765, "lng": 121.0356, "name": "EDSA & Boni Avenue"},
        {"lat": 14.6178, "lng": 121.0359, "name": "EDSA & Magsaysay Boulevard"},
        {"lat": 14.6300, "lng": 121.0300, "name": "EDSA & Quezon Avenue"},
        {"lat": 14.5833, "lng": 121.0589, "name": "EDSA & Ortigas Avenue"},
    ]
    
    # Get EDSA traffic status
    edsa_status = None
    for road_key, road_data in data.items():
        if "edsa" in road_key.lower():
            edsa_status = road_data
            break
    
    # If we have EDSA data, map to our intersections
    if edsa_status:
        # CF values: 1=light, 2=moderate, 3=heavy, 4=slow
        flow_map = {1: 20, 2: 45, 3: 70, 4: 85}
        density = flow_map.get(edsa_status.get("CF", 2), 45)
        
        for coord in edsa_coordinates:
            results.append({
                "location": {"lat": coord["lat"], "lng": coord["lng"]},
                "density": density,
                "speed_level": edsa_status.get("CF", 2),  # 1-4
                "confidence": 0.9,  # MMDA data is generally reliable
                "source": "MMDA",
            })
    
    return results

async def enhance_with_traffic(real_data: Optional[List[Dict]], simulated: dict) -> dict:
    """
    Enhance simulated intersection data with real traffic when available.
    Returns modified simulated data with real traffic values where possible.
    """
    if not real_data:
        return simulated
    
    # For each simulated intersection, find nearest real traffic data
    for inter in simulated.get("intersections", []):
        lat, lng = inter.get("lat", 0), inter.get("lng", 0)
        
        # Find closest real traffic point (simple distance check)
        closest = min(real_data, key=lambda r: 
            abs(r["location"]["lat"] - lat) + abs(r["location"]["lng"] - lng))
        
        # If reasonably close, use real density
        if closest["confidence"] > 0.5:
            inter["density"] = int(closest["density"])
            inter["speed_level"] = closest.get("speed_level", 2)
            inter["real_data"] = True
    
    return simulated