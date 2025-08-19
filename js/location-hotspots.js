// Butterfly observation hotspots in Bangalore and Karnataka
// Location data with accurate GPS coordinates and elevation details

const BUTTERFLY_LOCATIONS = [
  // Bangalore City Observation Sites
  {
    id: "jp_nagar_rf",
    name: "J.P. Nagar Reserve Forest",
    city: "Bangalore",
    state: "Karnataka",
    latitude: 12.8976,
    longitude: 77.5938,
    elevation: 910,
    type: "urban_forest",
    description: "Urban green space with regular butterfly records",
    isPopular: true
  },
  {
    id: "girinagar",
    name: "Girinagar",
    city: "Bangalore", 
    state: "Karnataka",
    latitude: 12.9447,
    longitude: 77.5311,
    elevation: 883,
    type: "urban_habitat",
    description: "Semi-urban habitat with diverse butterfly species",
    isPopular: true
  },
  {
    id: "bannerghatta_butterfly_park",
    name: "Bannerghatta Butterfly Park",
    city: "Bangalore",
    state: "Karnataka", 
    latitude: 12.8008,
    longitude: 77.5771,
    elevation: 920,
    type: "butterfly_park",
    description: "Rich butterfly diversity, active research center",
    isPopular: true
  },
  {
    id: "doddakallasandra_lake",
    name: "Doddakallasandra Lake (Konankunte)",
    city: "Bangalore",
    state: "Karnataka",
    latitude: 12.8820,
    longitude: 77.5600,
    elevation: 880,
    type: "wetland",
    description: "Wetland and urban edges, regular biodiversity surveys",
    isPopular: true
  },
  {
    id: "lalbagh_botanical_gardens", 
    name: "Lal Bagh Botanical Gardens",
    city: "Bangalore",
    state: "Karnataka",
    latitude: 12.9507,
    longitude: 77.5848,
    elevation: 920,
    type: "botanical_garden",
    description: "Historical urban park, long-term butterfly monitoring",
    isPopular: true
  },
  {
    id: "cubbon_park",
    name: "Cubbon Park", 
    city: "Bangalore",
    state: "Karnataka",
    latitude: 12.9760,
    longitude: 77.5920,
    elevation: 920,
    type: "urban_park",
    description: "Urban park, seasonal butterfly counts",
    isPopular: true
  },
  {
    id: "doresanipalya_forest",
    name: "Doresanipalya Forest Campus",
    city: "Bangalore",
    state: "Karnataka", 
    latitude: 12.9167,
    longitude: 77.5905,
    elevation: 900,
    type: "forest_campus",
    description: "Forest research campus, transect-based monitoring",
    isPopular: false
  },
  {
    id: "iisc_campus",
    name: "Indian Institute of Science (IISc)",
    city: "Bangalore",
    state: "Karnataka",
    latitude: 13.0217,
    longitude: 77.5672,
    elevation: 940,
    type: "academic_campus", 
    description: "Academic campus with established ecological transects",
    isPopular: false
  },
  
  // Other Key Karnataka Observation Sites
  {
    id: "mysore_area",
    name: "Mysore City Area",
    city: "Mysore",
    state: "Karnataka",
    latitude: 12.2958,
    longitude: 76.6394,
    elevation: 820,
    type: "urban_area",
    description: "Historic city with diverse butterfly habitats",
    isPopular: true
  },
  {
    id: "bettadapura_mysore",
    name: "Bettadapura (Mysore)",
    city: "Mysore",
    state: "Karnataka",
    latitude: 12.1500,
    longitude: 76.4500,
    elevation: 1338,
    type: "hill_station", 
    description: "High elevation butterfly observation site",
    isPopular: false
  },
  {
    id: "chamundi_hills",
    name: "Chamundi Hills",
    city: "Mysore", 
    state: "Karnataka",
    latitude: 12.2722,
    longitude: 76.6729,
    elevation: 1074,
    type: "hill_forest",
    description: "Sacred hill with diverse lepidoptera fauna",
    isPopular: true
  },
  {
    id: "jogimatti_forest",
    name: "Jogimatti Forest (Chitradurga)",
    city: "Chitradurga",
    state: "Karnataka",
    latitude: 14.1651,
    longitude: 76.3735,
    elevation: 825,
    type: "dry_forest",
    description: "Large stony forest, Western Ghats edge (500-1150m range)",
    isPopular: false
  },
  {
    id: "kunchebailu",
    name: "Kunchebailu (Chikmagalur)",
    city: "Chikmagalur",
    state: "Karnataka", 
    latitude: 13.3886,
    longitude: 75.2979,
    elevation: 900,
    type: "western_ghats",
    description: "Near Shringeri, Western Ghats, high species diversity",
    isPopular: false
  },
  
  // South India Regional Sites
  {
    id: "kallar_mettupalayam",
    name: "Kallar Region, Mettupalayam",
    city: "Mettupalayam",
    state: "Tamil Nadu",
    latitude: 11.2800,
    longitude: 76.9500,
    elevation: 325,
    type: "foothills",
    description: "Western Ghats foothills, diverse butterfly community",
    isPopular: false
  },
  {
    id: "wayanad_wildlife_sanctuary", 
    name: "Wayanad Wildlife Sanctuary",
    city: "Wayanad",
    state: "Kerala",
    latitude: 11.7400,
    longitude: 76.1350,
    elevation: 1375,
    type: "wildlife_sanctuary",
    description: "High altitude sanctuary (650-2100m), rich biodiversity",
    isPopular: true
  },
  {
    id: "munnar_high_ranges",
    name: "High-Range Munnar",
    city: "Munnar", 
    state: "Kerala",
    latitude: 10.0889,
    longitude: 77.0595,
    elevation: 1600,
    type: "hill_station",
    description: "Southern Western Ghats, high altitude butterfly habitat (>1500m)",
    isPopular: true
  },
  {
    id: "nagamalai_foothills",
    name: "Nagamalai Foothills",
    city: "Madurai",
    state: "Tamil Nadu",
    latitude: 9.8839,
    longitude: 78.0805,
    elevation: 250,
    type: "rocky_hills",
    description: "Near Madurai, varied habitat types (150-350m range)",
    isPopular: false
  },
  
  // Additional Bangalore Green Spaces
  {
    id: "sankey_tank",
    name: "Sankey Tank",
    city: "Bangalore",
    state: "Karnataka",
    latitude: 12.9881,
    longitude: 77.5664,
    elevation: 920,
    type: "urban_lake",
    description: "Urban lake with surrounding green space",
    isPopular: false
  },
  {
    id: "ulsoor_lake",
    name: "Ulsoor Lake", 
    city: "Bangalore",
    state: "Karnataka",
    latitude: 12.9809,
    longitude: 77.6182,
    elevation: 920,
    type: "urban_lake",
    description: "Central Bangalore lake, regular butterfly sightings",
    isPopular: false
  },
  {
    id: "bellandur_lake",
    name: "Bellandur Lake",
    city: "Bangalore",
    state: "Karnataka",
    latitude: 12.9258,
    longitude: 77.6815,
    elevation: 905,
    type: "urban_lake",
    description: "Large urban lake with wetland birds and butterflies",
    isPopular: false
  },
  {
    id: "nandi_hills", 
    name: "Nandi Hills",
    city: "Bangalore",
    state: "Karnataka", 
    latitude: 13.3706,
    longitude: 77.6837,
    elevation: 1478,
    type: "hill_station",
    description: "Popular hill station near Bangalore, high elevation habitat",
    isPopular: true
  },
  {
    id: "turahalli_forest",
    name: "Turahalli Forest",
    city: "Bangalore",
    state: "Karnataka",
    latitude: 12.8544,
    longitude: 77.4989,
    elevation: 890,
    type: "peri_urban_forest",
    description: "Peri-urban forest, regular observation walks",
    isPopular: true
  }
];

// Helper functions for location data
function getLocationById(id) {
  return BUTTERFLY_LOCATIONS.find(location => location.id === id);
}

function getLocationsByCity(city) {
  return BUTTERFLY_LOCATIONS.filter(location => 
    location.city.toLowerCase() === city.toLowerCase()
  );
}

function getLocationsByState(state) {
  return BUTTERFLY_LOCATIONS.filter(location =>
    location.state.toLowerCase() === state.toLowerCase()
  );
}

function getLocationsByType(type) {
  return BUTTERFLY_LOCATIONS.filter(location => location.type === type);
}

function getPopularLocations() {
  return BUTTERFLY_LOCATIONS.filter(location => location.isPopular);
}

function getLocationsByElevationRange(minElevation, maxElevation) {
  return BUTTERFLY_LOCATIONS.filter(location => 
    location.elevation >= minElevation && location.elevation <= maxElevation
  );
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BUTTERFLY_LOCATIONS,
    getLocationById,
    getLocationsByCity,
    getLocationsByState, 
    getLocationsByType,
    getPopularLocations,
    getLocationsByElevationRange
  };
}
