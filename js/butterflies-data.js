// Butterfly Database - Updated with IFB.csv data
// Data organized by family for the Butterfly Count app

// Load the JSON data and transform it to match the expected structure
let BUTTERFLY_DATA = [];

// Family information with descriptions and characteristics
const BUTTERFLY_FAMILIES = {
  "Hesperiidae": {
    commonName: "Skippers",
    description: "Small to medium-sized butterflies with rapid, darting flight patterns. Distinguished by their hooked antennae and robust bodies. Often brown or orange with distinctive wing markings. Includes awls, swifts, darts, and various specialized groups.",
    characteristics: ["Rapid flight", "Hooked antennae", "Robust bodies", "Earth tones", "Triangular wings"],
    icon: "⚡"
  },
  "Lycaenidae": {
    commonName: "Gossamer-winged Butterflies", 
    description: "Small, delicate butterflies with iridescent wings and intricate patterns. Known for brilliant blues, coppers, and hairstreaks. Many species have close relationships with ants. Includes blues, coppers, hairstreaks, and various specialized groups.",
    characteristics: ["Small size", "Metallic colors", "Delicate wings", "Ant associations", "Iridescent blues"],
    icon: "💎"
  },
  "Nymphalidae": {
    commonName: "Brush-footed Butterflies",
    description: "The largest butterfly family with diverse patterns and colors. Includes tigers, crows, pansies, emperors, and many other groups. Known for their reduced front legs and incredible variety of wing patterns. Many are large and colorful.",
    characteristics: ["Diverse patterns", "Variable sizes", "Reduced front legs", "Wide distribution", "Bright colors"],
    icon: "🎨"
  },
  "Papilionidae": {
    commonName: "Swallowtail Butterflies",
    description: "Large, colorful butterflies known for their distinctive tail-like extensions on the hindwings. Many species are brightly colored with bold patterns and are among the most recognizable butterflies. Includes swallowtails, birdwings, and roses.",
    characteristics: ["Large size", "Distinctive tails", "Bright colors", "Bold patterns", "Strong flight"],
    icon: "🦋"
  },
  "Pieridae": {
    commonName: "Whites, Yellows, and Sulphurs",
    description: "Medium-sized butterflies predominantly white, yellow, or orange in color. Known for their simple wing patterns and are often seen in gardens and agricultural areas. Includes whites, yellows, orange-tips, and emigrants.",
    characteristics: ["White/yellow colors", "Simple patterns", "Medium size", "Garden visitors", "Migratory species"],
    icon: "🟡"
  },
  "Riodinidae": {
    commonName: "Metalmark Butterflies",
    description: "Small butterflies with metallic markings on their wings. Known for their unique wing patterns and behavior. Males often perch with wings spread. A smaller family with distinctive characteristics.",
    characteristics: ["Metallic markings", "Unique patterns", "Small size", "Perching behavior", "Distinctive males"],
    icon: "✨"
  }
};

// Subfamily information for enhanced organization
const SUBFAMILY_INFO = {
  // Hesperiidae subfamilies
  "Coeliadinae": {
    commonName: "Awls",
    description: "Medium-sized skippers with pointed forewings and distinctive wing patterns."
  },
  "Hesperiinae": {
    commonName: "Grass Skippers", 
    description: "Small to medium skippers often found near grasses and in open areas."
  },
  "Pyrginae": {
    commonName: "Spread-wing Skippers",
    description: "Skippers that rest with wings spread horizontally, often with spotted patterns."
  },
  
  // Lycaenidae subfamilies
  "Miletinae": {
    commonName: "Harvesters",
    description: "Small lycaenids with unique feeding habits, some species are predatory."
  },
  "Aphnaeinae": {
    commonName: "Silverlines",
    description: "Small lycaenids with distinctive silver lines on the undersides of wings."
  },
  "Curetinae": {
    commonName: "Sunbeams",
    description: "Distinctive lycaenids with bright, reflective wing patterns."
  },
  "Polyommatinae": {
    commonName: "Blues",
    description: "Small lycaenids typically blue in males, often with intricate eyespots."
  },
  "Theclinae": {
    commonName: "Hairstreaks",
    description: "Lycaenids with hair-like tails on hindwings and complex patterns."
  },
  
  // Nymphalidae subfamilies
  "Biblidinae": {
    commonName: "Biblidines",
    description: "Diverse nymphalids with varied patterns and ecological adaptations."
  },
  "Charaxinae": {
    commonName: "Rajahs and Nawabs",
    description: "Large, robust nymphalids with powerful flight and bold patterns."
  },
  "Danainae": {
    commonName: "Milkweed Butterflies",
    description: "Large nymphalids known for their toxicity and migration patterns."
  },
  "Heliconiinae": {
    commonName: "Longwings",
    description: "Nymphalids with elongated wings, often toxic and colorful."
  },
  "Libytheinae": {
    commonName: "Snout Butterflies",
    description: "Distinctive nymphalids with prominent snout-like projections."
  },
  "Limenitidinae": {
    commonName: "Admirals and Relatives",
    description: "Medium to large nymphalids with distinctive flight patterns."
  },
  "Nymphalinae": {
    commonName: "True Brush-foots",
    description: "Diverse group including emperors, admirals, and tortoiseshells."
  },
  "Satyrinae": {
    commonName: "Satyrs and Wood-nymphs",
    description: "Brown butterflies with eyespots, often found in woodland areas."
  },
  
  // Papilionidae subfamilies
  "Papilioninae": {
    commonName: "Swallowtails",
    description: "Large butterflies with distinctive tailed hindwings and bold patterns."
  },
  
  // Pieridae subfamilies  
  "Coliadinae": {
    commonName: "Sulphurs and Yellows",
    description: "Yellow and orange pierids, often seen in large numbers."
  },
  "Pierinae": {
    commonName: "Whites",
    description: "Predominantly white pierids with simple but elegant patterns."
  },
  
  // Riodinidae subfamilies
  "Nemeobiinae": {
    commonName: "Metalmarks",
    description: "Small butterflies with metallic markings and unique behaviors."
  }
};

// Load and transform the JSON data
async function loadButterflyData() {
  try {
    const response = await fetch('./butterflies-data.json');
    const jsonData = await response.json();
    
    // Transform JSON data to match expected structure
    BUTTERFLY_DATA = jsonData.map(butterfly => ({
      id: butterfly.id,
      commonName: butterfly.commonName,
      scientificName: butterfly.scientificName,
      family: butterfly.family,
      subfamily: butterfly.subfamily,
      tribe: butterfly.tribe !== "–" ? butterfly.tribe : null,
      commonFamilyName: BUTTERFLY_FAMILIES[butterfly.family]?.commonName || butterfly.family,
      authority: "", // Not available in source data
      year: "" // Not available in source data
    }));
    
    console.log(`Loaded ${BUTTERFLY_DATA.length} butterfly species`);
    return BUTTERFLY_DATA;
  } catch (error) {
    console.error('Error loading butterfly data:', error);
    // Fallback to empty array
    BUTTERFLY_DATA = [];
    return BUTTERFLY_DATA;
  }
}

// Get butterflies by family
function getButterflysByFamily(family) {
  return BUTTERFLY_DATA.filter(butterfly => butterfly.family === family);
}

// Get butterflies by subfamily
function getButterflysBySubfamily(subfamily) {
  return BUTTERFLY_DATA.filter(butterfly => butterfly.subfamily === subfamily);
}

// Get family statistics
function getFamilyStats() {
  const stats = {};
  Object.keys(BUTTERFLY_FAMILIES).forEach(family => {
    const butterflies = getButterflysByFamily(family);
    stats[family] = {
      ...BUTTERFLY_FAMILIES[family],
      actualCount: butterflies.length
    };
  });
  return stats;
}

// Get subfamily statistics for a family
function getSubfamilyStats(family) {
  const butterflies = getButterflysByFamily(family);
  const subfamilyStats = {};
  
  butterflies.forEach(butterfly => {
    const subfamily = butterfly.subfamily;
    if (!subfamilyStats[subfamily]) {
      subfamilyStats[subfamily] = {
        ...SUBFAMILY_INFO[subfamily],
        count: 0,
        species: []
      };
    }
    subfamilyStats[subfamily].count++;
    subfamilyStats[subfamily].species.push(butterfly);
  });
  
  return subfamilyStats;
}

// Utility function to get total species count from family data
function getTotalSpeciesCount() {
  return BUTTERFLY_DATA.length;
}

// Search function
function searchButterflies(query) {
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) return BUTTERFLY_DATA;
  
  return BUTTERFLY_DATA.filter(butterfly => 
    butterfly.commonName.toLowerCase().includes(searchTerm) ||
    butterfly.scientificName.toLowerCase().includes(searchTerm) ||
    butterfly.commonFamilyName.toLowerCase().includes(searchTerm) ||
    butterfly.family.toLowerCase().includes(searchTerm) ||
    (butterfly.subfamily && butterfly.subfamily.toLowerCase().includes(searchTerm))
  );
}

// Get all unique families
function getButterflyFamilies() {
  const families = [...new Set(BUTTERFLY_DATA.map(b => b.commonFamilyName))];
  return families.sort();
}

// Get butterflies by family (using common name)
function getButterflyByFamily(familyName) {
  if (!familyName) return BUTTERFLY_DATA;
  
  return BUTTERFLY_DATA.filter(butterfly => 
    butterfly.commonFamilyName === familyName
  );
}

// Get butterfly by ID
function getButterflyById(id) {
  return BUTTERFLY_DATA.find(butterfly => butterfly.id === id);
}

// Get butterfly by name (exact match)
function getButterflyByName(name) {
  return BUTTERFLY_DATA.find(butterfly => 
    butterfly.commonName.toLowerCase() === name.toLowerCase()
  );
}

// Get grouped butterflies by family
function getGroupedButterflies() {
  const grouped = {};
  
  BUTTERFLY_DATA.forEach(butterfly => {
    const family = butterfly.commonFamilyName;
    if (!grouped[family]) {
      grouped[family] = [];
    }
    grouped[family].push(butterfly);
  });
  
  // Sort butterflies within each family
  Object.keys(grouped).forEach(family => {
    grouped[family].sort((a, b) => a.commonName.localeCompare(b.commonName));
  });
  
  return grouped;
}

// Get grouped butterflies by subfamily within a family
function getGroupedButterflysBySubfamily(family) {
  const butterflies = getButterflysByFamily(family);
  const grouped = {};
  
  butterflies.forEach(butterfly => {
    const subfamily = butterfly.subfamily || 'Unknown';
    if (!grouped[subfamily]) {
      grouped[subfamily] = [];
    }
    grouped[subfamily].push(butterfly);
  });
  
  // Sort butterflies within each subfamily
  Object.keys(grouped).forEach(subfamily => {
    grouped[subfamily].sort((a, b) => a.commonName.localeCompare(b.commonName));
  });
  
  return grouped;
}

// Initialize data loading
loadButterflyData();

// Make SUBFAMILY_INFO globally available
window.SUBFAMILY_INFO = SUBFAMILY_INFO;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BUTTERFLY_DATA,
    BUTTERFLY_FAMILIES,
    SUBFAMILY_INFO,
    loadButterflyData,
    getButterflyFamilies,
    searchButterflies,
    getButterflyByFamily,
    getButterflyById,
    getButterflyByName,
    getGroupedButterflies,
    getGroupedButterflysBySubfamily,
    getButterflysByFamily,
    getButterflysBySubfamily,
    getFamilyStats,
    getSubfamilyStats,
    getTotalSpeciesCount
  };
}
