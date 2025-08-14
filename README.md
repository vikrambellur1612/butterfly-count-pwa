# Butterfly Count PWA - Netlify Deployment

This folder contains all the files needed for deploying the Butterfly Count Progressive Web App to Netlify.

## Version 1.5.0 Features

### 🦋 Enhanced Butterfly Database
- **253 butterfly species** from IFB.csv dataset across 6 major families
- **Subfamily organization** with detailed taxonomic information
- **Tribe classifications** where available
- Enhanced search and filter functionality
- Rich species detail modals with scientific names

### 📊 Improved Organization
- **Family View**: Interactive cards showing actual species counts
- **Subfamily Sections**: Organized display within family modals
- **Taxonomic Hierarchy**: Family → Subfamily → Tribe → Species
- **Enhanced Descriptions**: Detailed information for families and subfamilies

### � Advanced Search
- **Common Name Search**: Primary search method for Count page
- **Scientific Name Display**: Shown in detail modals and cards
- **Multi-field Search**: Search across common names, scientific names, families, and subfamilies
- **Autocomplete**: Smart suggestions while typing

### 📱 Progressive Web App
- Offline functionality with cached butterfly data
- Installable on mobile devices
- Responsive design for all screen sizes
- Background sync capabilities

## Deployment Instructions

1. **Deploy to Netlify**: Simply drag and drop this entire folder to Netlify or connect via Git
2. **Build Settings**: No build process required - this is a client-side application
3. **Environment**: Works with any modern web browser
4. **Domain**: Will work with any custom domain or Netlify subdomain

## Data Structure

### Families Included
- **Hesperiidae** (Skippers) - 38 species
- **Lycaenidae** (Gossamer-winged Butterflies) - 54 species  
- **Nymphalidae** (Brush-footed Butterflies) - 67 species
- **Papilionidae** (Swallowtail Butterflies) - 19 species
- **Pieridae** (Whites, Yellows, and Sulphurs) - 24 species
- **Riodinidae** (Metalmark Butterflies) - 2 species

### New in Version 1.5.0
- Updated branding and removed specific organization references
- New app icon and favicon based on provided butterfly image
- Version bump to 1.5.0 with updated cache versioning
- ✅ Complete data migration from IFB.csv
- ✅ Subfamily organization with descriptions
- ✅ Tribe information where available
- ✅ Enhanced family modals with species grouping
- ✅ Improved taxonomic detail displays
- ✅ Common name as primary search field
- ✅ Scientific names in detail modals

## Technical Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Data**: JSON-based butterfly database
- **Storage**: IndexedDB for offline data persistence
- **PWA**: Service Worker, Web App Manifest
- **Responsive**: Mobile-first design with CSS Grid/Flexbox

## File Structure
```
netlify-deployment/
├── index.html                 # Main application
├── manifest.json             # PWA manifest  
├── sw.js                     # Service worker
├── netlify.toml              # Netlify config
├── butterflies-data.json    # Butterfly dataset
├── css/
│   ├── styles.css           # Main styles
│   └── mobile.css           # Mobile responsive
├── js/
│   ├── app.js               # Application logic
│   ├── butterflies-data.js  # Data handling
│   └── sw-register.js       # Service worker registration
└── icons/                   # PWA icons and favicons
```

## Browser Support
- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Mobile browsers with PWA support

---

**Ready for deployment!** 🚀
