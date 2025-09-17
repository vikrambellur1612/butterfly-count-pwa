// Main application logic for Butterfly Count PWA

class ButterflyCountApp {
  constructor() {
    this.version = '5.1.0';
    this.currentView = 'butterflies';
    this.currentButterflyView = 'family'; // 'family' or 'species'
    this.currentList = null;
    this.selectedCountViewList = null; // Track selected list for count view
    this.db = null;
    this.observations = [];
    this.lists = [];
    this.allLocations = []; // All locations from JSON file (predefined + custom)
    this.init();
  }

  async init() {
    await this.initDB();
    this.checkAppVersion();
    this.setupEventListeners();
    await this.loadData(); // Wait for data including locations to load
    
    // Wait for butterfly data to load
    await this.ensureButterflyDataLoaded();
    
    // Validate observation data integrity
    await this.validateObservationData();
    
    this.renderButterflies();
    this.updateTotalSpeciesCount();
    this.populateLocationDropdown();
    this.hideLoadingScreen();
    this.setupAutoComplete();
    
    // Setup location event listeners after everything else is ready
    // Add a small delay to ensure DOM is completely rendered
    setTimeout(() => {
      console.log('Setting up location event listeners after DOM is ready');
      this.setupLocationEventListeners();
    }, 100);
  }

  // Ensure butterfly data is loaded before proceeding
  async ensureButterflyDataLoaded() {
    // Wait until BUTTERFLY_DATA is populated
    let attempts = 0;
    while ((!BUTTERFLY_DATA || BUTTERFLY_DATA.length === 0) && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (BUTTERFLY_DATA && BUTTERFLY_DATA.length > 0) {
      console.log(`Butterfly data loaded: ${BUTTERFLY_DATA.length} species`);
    } else {
      console.error('Failed to load butterfly data');
    }
  }

  // Validate observation data integrity
  async validateObservationData() {
    try {
      let fixedCount = 0;
      const invalidObservations = [];
      
      for (const obs of this.observations) {
        const butterfly = getButterflyById(obs.butterflyId);
        if (!butterfly) {
          // Try to find by name
          const butterflyByName = getButterflyByName(obs.butterflyName);
          if (butterflyByName) {
            console.log(`Fixing observation ID: ${obs.butterflyId} -> ${butterflyByName.id} for ${obs.butterflyName}`);
            obs.butterflyId = butterflyByName.id;
            await this.updateInStore('observations', obs);
            fixedCount++;
          } else {
            invalidObservations.push(obs);
            console.warn('Invalid observation found:', {
              id: obs.id,
              butterflyName: obs.butterflyName,
              butterflyId: obs.butterflyId,
              listId: obs.listId
            });
          }
        }
      }
      
      if (fixedCount > 0) {
        console.log(`Fixed ${fixedCount} observation(s) with incorrect butterfly IDs`);
        this.observations = await this.getAllFromStore('observations');
        this.showToast(`Fixed ${fixedCount} observation data issue(s)`, 'info', 5000);
      }
      
      if (invalidObservations.length > 0) {
        console.warn(`Found ${invalidObservations.length} observations with unresolvable species names`);
      }
      
    } catch (error) {
      console.error('Error validating observation data:', error);
    }
  }

  // Check app version and clear cache if needed
  checkAppVersion() {
    const storedVersion = localStorage.getItem('butterflyAppVersion');
    if (storedVersion !== this.version) {
      console.log(`App updated from ${storedVersion || 'unknown'} to ${this.version}`);
      localStorage.setItem('butterflyAppVersion', this.version);
      
      // Clear any old cached data that might be incompatible
      this.clearOldCache();
      
      // Force icon cache refresh for PWA
      this.clearIconCaches();
      
      // Show update notification if this isn't the first install
      if (storedVersion) {
        this.showToast(`App updated to version ${this.version}! New icons loaded. For best experience, please reinstall the PWA.`, 'success', 10000);
      }
    }
  }

  // Clear old cache data
  async clearOldCache() {
    try {
      // Clear any old localStorage data that might be incompatible
      const keysToPreserve = ['butterflyAppVersion', 'installBannerDismissed'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('Old cache data cleared');
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  }

  // Clear icon caches to force fresh PWA icons
  async clearIconCaches() {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        const iconCachePromises = cacheNames.map(async (cacheName) => {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          const iconKeys = keys.filter(request => 
            request.url.includes('/icons/') || 
            request.url.includes('apple-touch-icon') ||
            request.url.includes('favicon') ||
            request.url.includes('manifest.json')
          );
          
          const deletePromises = iconKeys.map(key => cache.delete(key));
          await Promise.all(deletePromises);
          
          if (iconKeys.length > 0) {
            console.log(`Cleared ${iconKeys.length} icon entries from cache: ${cacheName}`);
          }
        });
        
        await Promise.all(iconCachePromises);
        
        // For iPhone specifically - try to force cache-busting for PWA manifest
        if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
          console.log('iPhone/iPad detected - clearing PWA icon caches');
          
          // Clear manifest cache specifically
          if ('registration' in navigator.serviceWorker && navigator.serviceWorker.registration) {
            try {
              await navigator.serviceWorker.registration.update();
              console.log('Service worker updated - manifest should refresh');
            } catch (error) {
              console.error('Failed to update service worker:', error);
            }
          }
          
          // Show specific iPhone instructions
          this.showToast('📱 iPhone detected: For icon update, please delete and reinstall the PWA app. This is required due to iOS icon caching.', 'info', 15000);
        }
        
        console.log('Icon caches cleared successfully');
      }
    } catch (error) {
      console.error('Error clearing icon caches:', error);
    }
  }

  // IndexedDB initialization
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ButterflyCountDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Observations store
        if (!db.objectStoreNames.contains('observations')) {
          const observationStore = db.createObjectStore('observations', { keyPath: 'id', autoIncrement: true });
          observationStore.createIndex('timestamp', 'timestamp', { unique: false });
          observationStore.createIndex('listId', 'listId', { unique: false });
          observationStore.createIndex('butterflyId', 'butterflyId', { unique: false });
        }
        
        // Lists store
        if (!db.objectStoreNames.contains('lists')) {
          const listStore = db.createObjectStore('lists', { keyPath: 'id', autoIncrement: true });
          listStore.createIndex('timestamp', 'timestamp', { unique: false });
          listStore.createIndex('status', 'status', { unique: false });
        }
        
        // Custom locations store
        if (!db.objectStoreNames.contains('custom_locations')) {
          const customLocationStore = db.createObjectStore('custom_locations', { keyPath: 'id', autoIncrement: true });
          customLocationStore.createIndex('name', 'name', { unique: false });
        }
        
        // Sync queue for offline operations
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // Database operations
  async addToStore(storeName, data) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.add({ ...data, timestamp: Date.now() });
  }

  async getAllFromStore(storeName) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateInStore(storeName, data) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.put(data);
  }

  async deleteFromStore(storeName, id) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.delete(id);
  }

  // Load all locations from JSON file (unified location management)
  async loadLocationsFromJSON() {
    try {
      const response = await fetch('./data/locations.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Loaded ${data.locations.length} locations from JSON file`);
      return data.locations || [];
      
    } catch (error) {
      console.error('❌ Error loading locations from JSON:', error);
      // Fallback to predefined locations if JSON fails to load
      return this.getFallbackLocations();
    }
  }

  // Save locations back to JSON file (this updates the locations.json)
  async saveLocationsToJSON() {
    try {
      const locationData = {
        metadata: {
          version: "5.1.0",
          lastUpdated: new Date().toISOString(),
          totalLocations: this.allLocations.length,
          description: "Butterfly observation locations in Karnataka and South India"
        },
        locations: this.allLocations
      };

      // In a real implementation, this would need a backend API to save the file
      // For now, we'll use localStorage as a fallback and show a message
      localStorage.setItem('butterfly-locations-backup', JSON.stringify(locationData));
      
      console.log(`� Saved ${this.allLocations.length} locations (localStorage backup)`);
      
      // Show user a message about the limitation
      this.showToast('Location saved! Note: In a production app, this would update the server file.', 'info');
      
    } catch (error) {
      console.error('❌ Error saving locations:', error);
      this.showToast('Error saving location', 'error');
    }
  }

  // Fallback locations in case JSON file fails to load
  getFallbackLocations() {
    return [
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
        isPopular: true,
        isCustom: false,
        createdAt: new Date().toISOString()
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
        isPopular: true,
        isCustom: false,
        createdAt: new Date().toISOString()
      }
    ];
  }

  // Event listeners setup
  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.switchView(view);
      });
    });

    // Search functionality
    const searchBtn = document.getElementById('searchBtn');
    const butterflySearch = document.getElementById('butterflySearch');
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        // Switch to butterflies view if not already there
        if (this.currentView !== 'butterflies') {
          this.switchView('butterflies');
        }
        
        // Focus the search input after a small delay to ensure view has switched
        setTimeout(() => {
          const butterflySearchInput = document.getElementById('butterflySearch');
          if (butterflySearchInput) {
            butterflySearchInput.focus();
          }
        }, 100);
      });
    }

    if (butterflySearch) {
      butterflySearch.addEventListener('input', (e) => {
        this.handleButterflySearch(e.target.value);
      });
    }

    // Family filter
    const familyFilter = document.getElementById('familyFilter');
    if (familyFilter) {
      familyFilter.addEventListener('change', (e) => {
        this.filterByFamily(e.target.value);
      });
    }

    // View toggle buttons
    const familyViewBtn = document.getElementById('familyViewBtn');
    const speciesViewBtn = document.getElementById('speciesViewBtn');
    
    if (familyViewBtn) {
      familyViewBtn.addEventListener('click', () => {
        this.switchButterflyView('family');
      });
    }

    if (speciesViewBtn) {
      speciesViewBtn.addEventListener('click', () => {
        this.switchButterflyView('species');
      });
    }

    // Create list button
    const createListBtn = document.getElementById('createListBtn');
    if (createListBtn) {
      createListBtn.addEventListener('click', () => {
        this.populateCreateListForm();
        this.showModal('createListModal');
      });
    }

    // Create list form
    const createListForm = document.getElementById('createListForm');
    if (createListForm) {
      createListForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.createNewList();
      });
    }

    // Add butterfly form
    const addButterflyBtn = document.getElementById('addButterflyBtn');
    if (addButterflyBtn) {
      addButterflyBtn.addEventListener('click', () => {
        this.addButterfly();
      });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const modalId = e.target.dataset.modal;
        // Clear form if it's the create list modal
        if (modalId === 'createListModal') {
          const form = document.getElementById('createListForm');
          if (form) {
            form.reset();
          }
          // Reset custom location fields to hidden state
          this.hideCustomLocationFields();
        }
        this.hideModal(modalId);
      });
    });

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        const modalId = e.target.id;
        if (modalId) {
          this.hideModal(modalId);
        }
      }
    });

    // HTML download button
    const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
    if (downloadHtmlBtn) {
      downloadHtmlBtn.addEventListener('click', () => {
        this.generateHTMLReport();
      });
    }

    // Auto-complete for butterfly name input
    const butterflyNameInput = document.getElementById('butterflyNameInput');
    if (butterflyNameInput) {
      butterflyNameInput.addEventListener('input', (e) => {
        this.handleButterflyNameAutocomplete(e.target.value);
        
        // Auto-populate time when user selects/types butterfly name
        if (e.target.value.trim().length > 2) { // Start auto-populating after 3 characters
          const obsTimeInput = document.getElementById('obsTimeInput');
          if (obsTimeInput && !obsTimeInput.value) {
            const now = new Date();
            obsTimeInput.value = now.toTimeString().slice(0, 5);
          }
        }
      });
    }

    // Date/time auto-population is now handled in populateCreateListForm() method

    // Set current date/time for butterfly observation
    const obsDateInput = document.getElementById('obsDateInput');
    const obsTimeInput = document.getElementById('obsTimeInput');
    if (obsDateInput && obsTimeInput) {
      const now = new Date();
      obsDateInput.value = now.toISOString().split('T')[0];
      // Don't set time initially - let user choose
      
      // When time field gets focus and is empty, set current time
      obsTimeInput.addEventListener('focus', () => {
        if (!obsTimeInput.value) {
          const currentTime = new Date();
          obsTimeInput.value = currentTime.toTimeString().slice(0, 5);
        }
      });
    }

    // Setup input mode handling for form fields
    this.setupInputModeHandlers();
  }

  // Setup location-related event listeners
  setupLocationEventListeners() {
    console.log('Setting up location event listeners after DOM is ready');
    
    const addCustomLocationBtn = document.getElementById('addCustomLocationBtn');
    const saveCustomLocationBtn = document.getElementById('saveCustomLocation');
    const getCurrentLocationBtn = document.getElementById('getCurrentLocation');
    const customLocationFields = document.getElementById('customLocationFields');
    
    if (addCustomLocationBtn) {
      addCustomLocationBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Add Custom Location button clicked');
        this.showCustomLocationFields();
      });
    }
    
    if (saveCustomLocationBtn) {
      saveCustomLocationBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveInlineCustomLocation();
      });
    }
    
    if (getCurrentLocationBtn) {
      getCurrentLocationBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.getCurrentLocation();
      });
    }
  }

  // Setup input mode handlers for mobile keyboards and touch optimization
  setupInputModeHandlers() {
    const countInput = document.getElementById('countInput');
    const butterflyNameInput = document.getElementById('butterflyNameInput');
    const allFormInputs = [
      'butterflyNameInput',
      'speciesTypeInput',
      'obsDateInput',
      'obsTimeInput'
    ];

    // Set numeric keyboard for count input
    if (countInput) {
      countInput.addEventListener('focus', () => {
        countInput.setAttribute('inputmode', 'numeric');
      });
    }

    // Set text keyboard for all other inputs
    allFormInputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.addEventListener('focus', () => {
          input.setAttribute('inputmode', 'text');
        });
      }
    });

    // Mobile touch optimization - disable 300ms delay
    if (this.isMobileDevice()) {
      // Add touch-action CSS property via JavaScript for older browsers
      document.body.style.touchAction = 'manipulation';
      
      // Enable fast clicks for all interactive elements
      const interactiveElements = document.querySelectorAll('button, .action-btn, .nav-item, .butterfly-card, .list-card');
      interactiveElements.forEach(element => {
        element.style.touchAction = 'manipulation';
      });
    }
  }

  // Load data from IndexedDB
  async loadData() {
    try {
      this.observations = await this.getAllFromStore('observations');
      this.lists = await this.getAllFromStore('lists');
      
      // Load all locations from JSON file (replaces previous location loading)
      this.allLocations = await this.loadLocationsFromJSON();
      
      this.updateUI();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Update UI with current data
  updateUI() {
    this.renderLists();
    this.updateCountViewListSelector();  // Update count view list selector
    this.renderObservations();
  }

  // View switching
  switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    // Show selected view
    const targetView = document.getElementById(`${viewName}View`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    const activeNavItem = document.querySelector(`[data-view="${viewName}"]`);
    if (activeNavItem) {
      activeNavItem.classList.add('active');
    }

    this.currentView = viewName;

    // View-specific actions
    if (viewName === 'count') {
      this.currentList = null;  // Reset to show all observations by default
      this.updateCountViewListSelector();  // Update count view list selector
      this.renderObservations();  // Update observations list
    }
  }

  // Render butterflies
  renderButterflies() {
    if (this.currentButterflyView === 'family') {
      this.renderFamilyView();
    } else {
      this.renderSpeciesView();
    }
  }

  // Render family view with family cards
  renderFamilyView() {
    const container = document.getElementById('familiesGrid');
    if (!container) return;

    const familyStats = getFamilyStats();
    container.innerHTML = '';

    Object.keys(familyStats).forEach(familyKey => {
      const family = familyStats[familyKey];
      const familyCard = this.createFamilyCard(familyKey, family);
      container.appendChild(familyCard);
    });
  }

  // Render species view (original butterfly list)
  renderSpeciesView() {
    const container = document.getElementById('butterflyList');
    if (!container) return;

    const grouped = this.getGroupedButterflies();
    container.innerHTML = '';

    Object.keys(grouped).forEach(family => {
      const familySection = document.createElement('div');
      familySection.className = 'family-section';
      
      const familyHeader = document.createElement('h3');
      familyHeader.className = 'family-header';
      familyHeader.textContent = family;
      familySection.appendChild(familyHeader);

      const butterflyGrid = document.createElement('div');
      butterflyGrid.className = 'butterfly-grid';

      grouped[family].forEach(butterfly => {
        const butterflyCard = this.createButterflyCard(butterfly);
        butterflyGrid.appendChild(butterflyCard);
      });

      familySection.appendChild(butterflyGrid);
      container.appendChild(familySection);
    });

    // Populate family filter
    this.populateFamilyFilter();
  }

  // Create family card
  createFamilyCard(familyKey, family) {
    const card = document.createElement('div');
    card.className = 'family-card';
    card.innerHTML = `
      <div class="family-header">
        <span class="family-icon">${family.icon}</span>
        <div>
          <h3 class="family-name">${family.commonName}</h3>
          <p class="family-latin">${familyKey}</p>
        </div>
      </div>
      <p class="family-description">${family.description}</p>
      <div class="family-characteristics">
        ${family.characteristics.map(char => `<span class="characteristic-tag">${char}</span>`).join('')}
      </div>
      <div class="family-stats">
        <span class="species-count">${family.actualCount} species</span>
        <button class="view-family-btn" data-action="view-species">View Species</button>
      </div>
    `;

    // Use event delegation with proper button detection
    card.addEventListener('click', (e) => {
      // Check if click is on the button or button area
      const button = e.target.closest('.view-family-btn');
      if (button) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Family View Species button clicked');
        this.showFamilyModal(familyKey, family);
        return;
      }
      
      // Only allow clicks on non-button areas to show modal
      if (!e.target.closest('button')) {
        console.log('Family card clicked (non-button area)');
        this.showFamilyModal(familyKey, family);
      }
    });

    return card;
  }

  // Get grouped butterflies
  getGroupedButterflies() {
    const grouped = {};
    BUTTERFLY_DATA.forEach(butterfly => {
      if (!grouped[butterfly.commonFamilyName]) {
        grouped[butterfly.commonFamilyName] = [];
      }
      grouped[butterfly.commonFamilyName].push(butterfly);
    });
    return grouped;
  }

  // Create butterfly card
  createButterflyCard(butterfly) {
    const card = document.createElement('div');
    card.className = 'butterfly-card';
    card.innerHTML = `
      <div class="butterfly-info">
        <h4 class="butterfly-name">${butterfly.commonName}</h4>
        <p class="butterfly-scientific">${butterfly.scientificName}</p>
        <span class="butterfly-family">${butterfly.commonFamilyName}</span>
      </div>
    `;

    // Safe click handler - only for card areas, no button conflicts
    card.addEventListener('click', (e) => {
      // Prevent interference if any buttons are added in future
      if (!e.target.closest('button, .action-btn')) {
        console.log('Butterfly card clicked:', butterfly.commonName);
        this.showButterflyDetail(butterfly);
      }
    });

    return card;
  }

  // Show butterfly detail modal
  showButterflyDetail(butterfly) {
    const modal = document.getElementById('butterflyModal');
    const nameElement = document.getElementById('modalButterflyName');
    const contentElement = document.getElementById('modalButterflyContent');

    if (nameElement) {
      nameElement.textContent = butterfly.commonName;
    }

    if (contentElement) {
      const subfamilyInfo = butterfly.subfamily ? SUBFAMILY_INFO?.[butterfly.subfamily] : null;
      
      contentElement.innerHTML = `
        <div class="butterfly-detail">
          <div class="detail-section butterfly-photo-section">
            <div id="butterflyPhotoContainer" class="butterfly-photo-container">
              <div class="photo-loading">
                <div class="loading-spinner"></div>
                <p>Loading photo...</p>
              </div>
            </div>
            <div class="photo-disclaimer">
              <p><small><strong>Disclaimer:</strong> Photos are dynamically fetched from the internet and may sometimes show incorrect species. Please validate information independently.</small></p>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Scientific Name</h4>
            <p><em>${butterfly.scientificName}</em></p>
          </div>
          <div class="detail-section">
            <h4>Family</h4>
            <p>${butterfly.commonFamilyName} (<em>${butterfly.family}</em>)</p>
          </div>
          ${butterfly.subfamily ? `
          <div class="detail-section">
            <h4>Subfamily</h4>
            <p>${subfamilyInfo?.commonName || butterfly.subfamily} (<em>${butterfly.subfamily}</em>)</p>
            ${subfamilyInfo?.description ? `<p class="subfamily-desc">${subfamilyInfo.description}</p>` : ''}
          </div>` : ''}
          ${butterfly.tribe && butterfly.tribe !== '–' ? `
          <div class="detail-section">
            <h4>Tribe</h4>
            <p><em>${butterfly.tribe}</em></p>
          </div>` : ''}
        </div>
      `;

      // Fetch and display butterfly photo
      this.fetchButterflyPhoto(butterfly);
    }

    this.showModal('butterflyModal');
  }

  // Fetch butterfly photo from internet
  async fetchButterflyPhoto(butterfly) {
    const photoContainer = document.getElementById('butterflyPhotoContainer');
    if (!photoContainer) return;

    try {
      // Try multiple search terms for better results
      const searchTerms = [
        `${butterfly.scientificName} butterfly`,
        `${butterfly.commonName} butterfly`,
        `${butterfly.scientificName}`,
        `${butterfly.commonName} ${butterfly.family}`
      ];

      let photoFound = false;
      
      // Try Wikipedia first (most reliable for scientific content)
      for (const searchTerm of searchTerms) {
        if (photoFound) break;
        
        try {
          console.log(`Trying Wikipedia search for: ${searchTerm}`);
          const wikiResult = await this.fetchFromWikipedia(searchTerm);
          if (wikiResult) {
            this.displayButterflyPhoto(photoContainer, wikiResult.imageUrl, wikiResult.credit, 'Wikipedia');
            photoFound = true;
            break;
          }
        } catch (error) {
          console.log(`Wikipedia search failed for: ${searchTerm}`, error.message);
        }

        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // If Wikipedia didn't work, try a simple approach with butterfly-themed generic images
      if (!photoFound) {
        try {
          console.log('Trying generic nature image...');
          const genericResult = await this.fetchGenericButterflyImage();
          if (genericResult) {
            this.displayButterflyPhoto(photoContainer, genericResult.imageUrl, genericResult.credit, 'Stock Photo');
            photoFound = true;
          }
        } catch (error) {
          console.log('Generic image search failed:', error.message);
        }
      }

      // If all internet sources fail, use local SVG
      if (!photoFound) {
        console.log('Using local default butterfly illustration');
        this.displayPhotoError(photoContainer);
      }

    } catch (error) {
      console.error('Error fetching butterfly photo:', error);
      this.displayPhotoError(photoContainer);
    }
  }

  // Fetch from Wikipedia/Wikimedia
  async fetchFromWikipedia(searchTerm) {
    try {
      // Use the correct Wikipedia API endpoint with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=3`;
      const searchResponse = await fetch(searchUrl, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!searchResponse.ok) {
        throw new Error(`Wikipedia search failed: ${searchResponse.status}`);
      }
      
      const searchData = await searchResponse.json();

      if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
        // Try to get images from the first few relevant pages
        for (const page of searchData.query.search.slice(0, 2)) {
          try {
            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(() => pageController.abort(), 3000);
            
            // Get page content and images
            const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=300&pilimit=1&pageids=${page.pageid}&exintro=1&explaintext=1&exsentences=1`;
            const pageResponse = await fetch(pageUrl, { 
              signal: pageController.signal,
              headers: {
                'Accept': 'application/json'
              }
            });
            
            clearTimeout(pageTimeoutId);
            
            if (!pageResponse.ok) continue;
            
            const pageData = await pageResponse.json();
            const pageInfo = pageData.query?.pages?.[page.pageid];

            if (pageInfo && pageInfo.thumbnail && pageInfo.thumbnail.source) {
              // Get a higher resolution image
              let imageUrl = pageInfo.thumbnail.source;
              imageUrl = imageUrl.replace(/\/\d+px-/, '/400px-');
              
              return {
                imageUrl: imageUrl,
                credit: `${pageInfo.title || page.title}`
              };
            }
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Request timeout for page:', page.title);
            }
            continue;
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Wikipedia request timeout for:', searchTerm);
      } else {
        console.log('Wikipedia API error:', error.message);
      }
      throw error;
    }
    return null;
  }

  // Fetch from alternative free APIs
  async fetchFromUnsplash(searchTerm) {
    try {
      // This method is deprecated, but keeping for legacy
      throw new Error('Unsplash Source API no longer reliable');
    } catch (error) {
      throw error;
    }
  }

  // Fetch generic butterfly image as final fallback
  async fetchGenericButterflyImage() {
    try {
      // Use Lorem Picsum with a seed based on the current time
      // This provides consistent but varied images
      const seed = Math.floor(Date.now() / (1000 * 60 * 10)); // Changes every 10 minutes
      const imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
      
      // Test if the image loads
      const testImg = new Image();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Image loading timeout'));
        }, 3000);

        testImg.onload = () => {
          clearTimeout(timeout);
          resolve({
            imageUrl: imageUrl,
            credit: 'Generic Nature Photography'
          });
        };
        
        testImg.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Image failed to load'));
        };
        
        testImg.src = imageUrl;
      });
    } catch (error) {
      throw error;
    }
  }

  // Display the fetched photo
  displayButterflyPhoto(container, imageUrl, credit, source) {
    container.innerHTML = `
      <div class="butterfly-photo">
        <img src="${imageUrl}" alt="Butterfly photo" class="butterfly-image" onerror="this.parentElement.parentElement.innerHTML='<div class=\\'photo-error\\'>Photo could not be loaded</div>'">
        <div class="photo-credit">
          <small>📷 Photo: ${credit} via ${source}</small>
        </div>
      </div>
    `;
  }

  // Display error when photo cannot be fetched
  displayPhotoError(container) {
    // Use local SVG as final fallback
    container.innerHTML = `
      <div class="butterfly-photo">
        <img src="./icons/default-butterfly.svg" alt="Default butterfly illustration" class="butterfly-image">
        <div class="photo-credit">
          <small>📷 Default Illustration</small>
        </div>
      </div>
      <div class="photo-error-note">
        <small style="color: #64748b; font-style: italic;">Unable to fetch specific species photo from internet sources</small>
      </div>
    `;
  }

  // Switch butterfly view between family and species
  switchButterflyView(view) {
    this.currentButterflyView = view;
    
    // Update toggle buttons
    const familyBtn = document.getElementById('familyViewBtn');
    const speciesBtn = document.getElementById('speciesViewBtn');
    const familiesGrid = document.getElementById('familiesGrid');
    const speciesContainer = document.getElementById('speciesContainer');
    
    if (view === 'family') {
      familyBtn?.classList.add('active');
      speciesBtn?.classList.remove('active');
      familiesGrid?.classList.remove('hidden');
      speciesContainer?.classList.add('hidden');
    } else {
      familyBtn?.classList.remove('active');
      speciesBtn?.classList.add('active');
      familiesGrid?.classList.add('hidden');
      speciesContainer?.classList.remove('hidden');
    }
    
    this.renderButterflies();
  }

  // Show family modal with species list
  showFamilyModal(familyKey, family) {
    const modal = document.getElementById('familyModal');
    const titleElement = document.getElementById('familyModalTitle');
    const infoElement = document.getElementById('familyInfo');
    const speciesListElement = document.getElementById('familySpeciesList');
    const searchInput = document.getElementById('familySpeciesSearch');

    if (titleElement) {
      titleElement.textContent = family.commonName;
    }

    if (infoElement) {
      infoElement.innerHTML = `
        <h4>${family.icon} ${family.commonName}</h4>
        <p><em>${familyKey}</em></p>
        <p>${family.description}</p>
        <div class="family-characteristics">
          ${family.characteristics.map(char => `<span class="characteristic-tag">${char}</span>`).join('')}
        </div>
      `;
    }

    // Get species for this family grouped by subfamily
    this.renderFamilySpeciesGrouped(familyKey, speciesListElement);

    // Setup search within family
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = (e) => {
        const allSpecies = getButterflysByFamily(familyKey);
        const filteredSpecies = allSpecies.filter(butterfly =>
          butterfly.commonName.toLowerCase().includes(e.target.value.toLowerCase()) ||
          butterfly.scientificName.toLowerCase().includes(e.target.value.toLowerCase()) ||
          (butterfly.subfamily && butterfly.subfamily.toLowerCase().includes(e.target.value.toLowerCase()))
        );
        
        if (e.target.value.trim() === '') {
          this.renderFamilySpeciesGrouped(familyKey, speciesListElement);
        } else {
          this.renderFamilySpecies(filteredSpecies, speciesListElement);
        }
      };
    }

    this.showModal('familyModal');
  }

  // Render species list in family modal
  renderFamilySpecies(species, container) {
    if (!container) return;

    container.innerHTML = species.map(butterfly => `
      <div class="species-item" data-butterfly-id="${butterfly.id}">
        <div class="species-name">${butterfly.commonName}</div>
        <div class="species-scientific">${butterfly.scientificName}</div>
        <div class="species-subfamily">${butterfly.subfamily || 'Unknown'}</div>
      </div>
    `).join('');

    // Add click handlers to species items with proper event handling
    container.querySelectorAll('.species-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Prevent conflicts with any future buttons in species items
        if (!e.target.closest('button, .action-btn')) {
          e.preventDefault();
          e.stopPropagation();
          
          const butterflyId = parseInt(item.dataset.butterflyId);
          const butterfly = BUTTERFLY_DATA.find(b => b.id === butterflyId);
          if (butterfly) {
            console.log('Species item clicked (family modal):', butterfly.commonName);
            this.hideModal('familyModal');
            this.showButterflyDetail(butterfly);
          }
        }
      });
    });
  }

  // Render species list grouped by subfamily
  renderFamilySpeciesGrouped(familyKey, container) {
    if (!container) return;

    const subfamilyGroups = getGroupedButterflysBySubfamily(familyKey);
    const subfamilyStats = getSubfamilyStats(familyKey);
    
    let html = '';
    
    Object.keys(subfamilyGroups).forEach(subfamily => {
      const species = subfamilyGroups[subfamily];
      const subfamilyInfo = subfamilyStats[subfamily];
      
      html += `
        <div class="subfamily-section">
          <div class="subfamily-header">
            <h5 class="subfamily-name">${subfamilyInfo?.commonName || subfamily}</h5>
            <span class="subfamily-latin">${subfamily}</span>
            <span class="species-count">(${species.length} species)</span>
          </div>
          ${subfamilyInfo?.description ? `<p class="subfamily-description">${subfamilyInfo.description}</p>` : ''}
          <div class="subfamily-species">
            ${species.map(butterfly => `
              <div class="species-item" data-butterfly-id="${butterfly.id}">
                <div class="species-name">${butterfly.commonName}</div>
                <div class="species-scientific">${butterfly.scientificName}</div>
                ${butterfly.tribe && butterfly.tribe !== '–' ? `<div class="species-tribe">Tribe: ${butterfly.tribe}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;

    // Add click handlers to species items with proper event handling
    container.querySelectorAll('.species-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Prevent conflicts with any future buttons in species items
        if (!e.target.closest('button, .action-btn')) {
          e.preventDefault();
          e.stopPropagation();
          
          const butterflyId = parseInt(item.dataset.butterflyId);
          const butterfly = BUTTERFLY_DATA.find(b => b.id === butterflyId);
          if (butterfly) {
            console.log('Species item clicked (subfamily modal):', butterfly.commonName);
            this.hideModal('familyModal');
            this.showButterflyDetail(butterfly);
          }
        }
      });
    });
  }

  // Search functionality
  handleButterflySearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    if (!query || query.length < 2) {
      resultsContainer.classList.add('hidden');
      this.renderButterflies();
      return;
    }

    const results = searchButterflies(query);
    resultsContainer.classList.remove('hidden');
    
    resultsContainer.innerHTML = '';
    results.forEach(butterfly => {
      const resultItem = document.createElement('div');
      resultItem.className = 'search-result-item';
      resultItem.innerHTML = `
        <div class="result-info">
          <span class="result-name">${butterfly.commonName}</span>
          <span class="result-scientific">${butterfly.scientificName}</span>
          <span class="result-family">${butterfly.commonFamilyName}</span>
        </div>
      `;

      resultItem.addEventListener('click', (e) => {
        // Safe click handling for search results
        if (!e.target.closest('button, .action-btn')) {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('Search result clicked:', butterfly.commonName);
          this.showButterflyDetail(butterfly);
          resultsContainer.classList.add('hidden');
          document.getElementById('butterflySearch').value = '';
        }
      });

      resultsContainer.appendChild(resultItem);
    });
  }

  // Family filter
  populateFamilyFilter() {
    const familyFilter = document.getElementById('familyFilter');
    if (!familyFilter) return;

    const families = getButterflyFamilies();
    familyFilter.innerHTML = '<option value="">All Families</option>';
    
    families.forEach(family => {
      const option = document.createElement('option');
      option.value = family;
      option.textContent = family;
      familyFilter.appendChild(option);
    });
  }

  filterByFamily(familyName) {
    const container = document.getElementById('butterflyList');
    if (!container) return;

    if (!familyName) {
      this.renderSpeciesView();
      return;
    }

    const butterflies = getButterflyByFamily(familyName);
    container.innerHTML = '';

    const familySection = document.createElement('div');
    familySection.className = 'family-section';
    
    const familyHeader = document.createElement('h3');
    familyHeader.className = 'family-header';
    familyHeader.textContent = familyName;
    familySection.appendChild(familyHeader);

    const butterflyGrid = document.createElement('div');
    butterflyGrid.className = 'butterfly-grid';

    butterflies.forEach(butterfly => {
      const butterflyCard = this.createButterflyCard(butterfly);
      butterflyGrid.appendChild(butterflyCard);
    });

    familySection.appendChild(butterflyGrid);
    container.appendChild(familySection);
  }

  // Populate create list form with current date/time
  populateCreateListForm() {
    const now = new Date();
    const dateInput = document.getElementById('listDateInput');
    const timeInput = document.getElementById('listStartTimeInput');
    
    if (dateInput) {
      dateInput.value = now.toISOString().split('T')[0];
    }
    
    if (timeInput) {
      timeInput.value = now.toTimeString().slice(0, 5);
    }
  }

  // Location management methods
  getAllLocations() {
    return this.allLocations || [];
  }

  getLocationById(locationId) {
    const allLocations = this.getAllLocations();
    return allLocations.find(location => location.id === locationId);
  }

  // Populate location dropdown
  populateLocationDropdown() {
    const locationSelect = document.getElementById('listLocationSelect');
    if (!locationSelect) return;

    const allLocations = this.getAllLocations();
    
    // Clear existing options except the first one
    locationSelect.innerHTML = '<option value="">Select observation location...</option>';
    
    // Group locations by popularity, custom status, and state
    const popularLocations = allLocations.filter(loc => loc.isPopular && !loc.isCustom);
    const customLocations = allLocations.filter(loc => loc.isCustom);
    const otherLocations = allLocations.filter(loc => !loc.isPopular && !loc.isCustom);

    // Add popular locations first
    if (popularLocations.length > 0) {
      const popularGroup = document.createElement('optgroup');
      popularGroup.label = '⭐ Popular Locations';
      popularLocations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.id;
        option.textContent = `${location.name} (${location.city}, ${location.elevation}m)`;
        popularGroup.appendChild(option);
      });
      locationSelect.appendChild(popularGroup);
    }

    // Add custom locations
    if (customLocations.length > 0) {
      const customGroup = document.createElement('optgroup');
      customGroup.label = '📍 My Custom Locations';
      customLocations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.id;
        option.textContent = `${location.name}${location.city ? ` (${location.city})` : ''}${location.elevation ? `, ${location.elevation}m` : ''}`;
        customGroup.appendChild(option);
      });
      locationSelect.appendChild(customGroup);
    }

    // Add other locations grouped by state
    const stateGroups = {};
    otherLocations.forEach(location => {
      if (!stateGroups[location.state]) {
        stateGroups[location.state] = [];
      }
      stateGroups[location.state].push(location);
    });

    Object.keys(stateGroups).forEach(state => {
      const stateGroup = document.createElement('optgroup');
      stateGroup.label = `${state} Locations`;
      stateGroups[state].forEach(location => {
        const option = document.createElement('option');
        option.value = location.id;
        option.textContent = `${location.name} (${location.city}, ${location.elevation}m)`;
        stateGroup.appendChild(option);
      });
      locationSelect.appendChild(stateGroup);
    });
  }

  // Add custom location
  async addCustomLocation() {
    const name = document.getElementById('customLocationName').value;
    const city = document.getElementById('customLocationCity').value;
    const state = document.getElementById('customLocationState').value;
    const latitude = parseFloat(document.getElementById('customLocationLat').value);
    const longitude = parseFloat(document.getElementById('customLocationLng').value);
    const elevation = document.getElementById('customLocationElevation').value ? 
                     parseInt(document.getElementById('customLocationElevation').value) : null;
    const description = document.getElementById('customLocationDescription').value;

    if (!name || !latitude || !longitude) {
      this.showToast('Please fill in required fields (Name, Latitude, Longitude)', 'error');
      return;
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90) {
      this.showToast('Latitude must be between -90 and 90', 'error');
      return;
    }

    if (longitude < -180 || longitude > 180) {
      this.showToast('Longitude must be between -180 and 180', 'error');
      return;
    }

    const customLocation = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      city: city.trim() || 'Unknown',
      state: state.trim() || 'Unknown',
      latitude,
      longitude,
      elevation,
      type: 'custom',
      description: description.trim(),
      isPopular: false,
      isCustom: true,
      createdAt: Date.now()
    };

    try {
      // Add to JSON locations array
      this.allLocations.push(customLocation);
      
      // Save to JSON file
      await this.saveLocationsToJSON();
      
      this.populateLocationDropdown();
      this.hideModal('addCustomLocationModal');
      this.clearForm('addCustomLocationForm');
      
      // Show success message and return to create list modal
      this.showToast('Custom location added successfully! You can now select it from the dropdown.', 'success', 5000);
      vibrate([100, 100, 100]);
      
      // Return to create list modal after a short delay to show the toast
      setTimeout(() => {
        this.showModal('createListModal');
      }, 500);
    } catch (error) {
      console.error('Error adding custom location:', error);
      this.showToast('Error adding custom location', 'error');
    }
  }

  // Show custom location fields inline
  showCustomLocationFields() {
    const customLocationFields = document.getElementById('customLocationFields');
    const addCustomLocationBtn = document.getElementById('addCustomLocationBtn');
    
    if (customLocationFields) {
      customLocationFields.classList.remove('hidden');
      customLocationFields.style.display = 'block';
    }
    
    if (addCustomLocationBtn) {
      addCustomLocationBtn.style.display = 'none';
    }
    
    // Clear previous values
    document.getElementById('customLocationName').value = '';
    document.getElementById('customLocationCity').value = '';
    document.getElementById('customLocationState').value = '';
    document.getElementById('customLocationElevation').value = '';
    document.getElementById('customLocationLat').value = '';
    document.getElementById('customLocationLng').value = '';
    document.getElementById('customLocationDescription').value = '';
    
    // Add required attributes to custom location fields when shown
    document.getElementById('customLocationName').required = true;
    document.getElementById('customLocationLat').required = true;
    document.getElementById('customLocationLng').required = true;
    
    // Remove required from main location select since we're adding custom location
    document.getElementById('listLocationSelect').required = false;
  }
  
  // Hide custom location fields
  hideCustomLocationFields() {
    const customLocationFields = document.getElementById('customLocationFields');
    const addCustomLocationBtn = document.getElementById('addCustomLocationBtn');
    
    if (customLocationFields) {
      customLocationFields.classList.add('hidden');
      customLocationFields.style.display = 'none';
    }
    
    if (addCustomLocationBtn) {
      addCustomLocationBtn.style.display = 'block';
    }
    
    // Remove required attributes from custom location fields when hidden
    document.getElementById('customLocationName').required = false;
    document.getElementById('customLocationLat').required = false;
    document.getElementById('customLocationLng').required = false;
    
    // Restore required to main location select
    document.getElementById('listLocationSelect').required = true;
  }
  
  // Get current location using geolocation API with reverse geocoding
  getCurrentLocation() {
    const getCurrentLocationBtn = document.getElementById('getCurrentLocation');
    const originalText = getCurrentLocationBtn.textContent;
    
    if (!navigator.geolocation) {
      this.showToast('Geolocation is not supported by this browser', 'error');
      return;
    }
    
    getCurrentLocationBtn.textContent = '📍 Getting location...';
    getCurrentLocationBtn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Set coordinates
        document.getElementById('customLocationLat').value = lat.toFixed(6);
        document.getElementById('customLocationLng').value = lng.toFixed(6);
        
        // Set elevation if available
        if (position.coords.altitude) {
          document.getElementById('customLocationElevation').value = Math.round(position.coords.altitude);
        }
        
        // Update button text to show reverse geocoding is happening
        getCurrentLocationBtn.textContent = '🔍 Finding address...';
        
        // Perform reverse geocoding
        try {
          const locationInfo = await this.reverseGeocode(lat, lng);
          
          if (locationInfo) {
            // Auto-populate fields with geocoded data
            if (locationInfo.city) {
              document.getElementById('customLocationCity').value = locationInfo.city;
            }
            if (locationInfo.state) {
              document.getElementById('customLocationState').value = locationInfo.state;
            }
            if (locationInfo.country) {
              // You might want to add a country field or append to state
              const stateField = document.getElementById('customLocationState');
              if (stateField.value && locationInfo.country !== 'India') {
                stateField.value += `, ${locationInfo.country}`;
              }
            }
            
            // Suggest a location name based on the address
            const nameField = document.getElementById('customLocationName');
            if (!nameField.value && locationInfo.suggestedName) {
              nameField.value = locationInfo.suggestedName;
              nameField.select(); // Highlight the text so user can easily change it
            }
            
            this.showToast('Location details filled automatically! You can edit any field as needed.', 'success', 4000);
          } else {
            this.showToast('Location coordinates filled! Please fill in city and state manually.', 'info', 3000);
          }
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          this.showToast('Location coordinates filled! Please fill in city and state manually.', 'info', 3000);
        }
        
        getCurrentLocationBtn.textContent = originalText;
        getCurrentLocationBtn.disabled = false;
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Unable to get location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        
        this.showToast(errorMessage, 'error');
        getCurrentLocationBtn.textContent = originalText;
        getCurrentLocationBtn.disabled = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  }
  
  // Reverse geocoding to get address from coordinates
  async reverseGeocode(lat, lng) {
    try {
      // Try multiple geocoding services for better coverage
      const services = [
        () => this.reverseGeocodeNominatim(lat, lng),
        () => this.reverseGeocodeMapbox(lat, lng), // Backup service
      ];
      
      for (const service of services) {
        try {
          const result = await service();
          if (result) return result;
        } catch (error) {
          console.log('Geocoding service failed, trying next:', error.message);
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('All geocoding services failed:', error);
      return null;
    }
  }
  
  // Primary geocoding using Nominatim (OpenStreetMap)
  async reverseGeocodeNominatim(lat, lng) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`;
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ButterflyCountApp/3.1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.address) {
        const address = data.address;
        
        // Extract relevant information
        const city = address.city || address.town || address.village || address.suburb || address.neighbourhood || address.hamlet;
        const state = address.state || address.region || address.province;
        const country = address.country;
        
        // Create a suggested location name
        const neighbourhood = address.neighbourhood || address.suburb || address.village;
        const amenity = address.amenity;
        const tourism = address.tourism;
        const natural = address.natural;
        
        let suggestedName = '';
        if (amenity) {
          suggestedName = `${amenity} (${neighbourhood || city})`;
        } else if (tourism) {
          suggestedName = `${tourism} (${neighbourhood || city})`;
        } else if (natural) {
          suggestedName = `${natural} (${neighbourhood || city})`;
        } else if (neighbourhood) {
          suggestedName = `${neighbourhood}, ${city}`;
        } else {
          suggestedName = city || 'Custom Location';
        }
        
        return {
          city: city || '',
          state: state || '',
          country: country || '',
          suggestedName: suggestedName,
          fullAddress: data.display_name
        };
      }
      
      return null;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Geocoding request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  // Backup geocoding service (could be expanded with API key)
  async reverseGeocodeMapbox(lat, lng) {
    // For now, return null - this could be implemented with Mapbox API if needed
    // Would need API key: const token = 'YOUR_MAPBOX_TOKEN';
    return null;
  }
  
  // Save inline custom location
  async saveInlineCustomLocation() {
    const name = document.getElementById('customLocationName').value.trim();
    const city = document.getElementById('customLocationCity').value.trim();
    const state = document.getElementById('customLocationState').value.trim();
    const elevation = document.getElementById('customLocationElevation').value.trim();
    const lat = document.getElementById('customLocationLat').value.trim();
    const lng = document.getElementById('customLocationLng').value.trim();
    const description = document.getElementById('customLocationDescription').value.trim();
    
    // Validate required fields
    if (!name) {
      this.showToast('Please enter location name', 'error');
      document.getElementById('customLocationName').focus();
      return;
    }
    
    if (!lat || !lng) {
      this.showToast('Please provide latitude and longitude', 'error');
      if (!lat) {
        document.getElementById('customLocationLat').focus();
      } else {
        document.getElementById('customLocationLng').focus();
      }
      return;
    }
    
    // Validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      this.showToast('Invalid latitude. Must be between -90 and 90', 'error');
      document.getElementById('customLocationLat').focus();
      return;
    }
    
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      this.showToast('Invalid longitude. Must be between -180 and 180', 'error');
      document.getElementById('customLocationLng').focus();
      return;
    }
    
    try {
      // Create new location object
      const newLocation = {
        id: `custom_${Date.now()}`,
        name: name,
        city: city || 'Unknown',
        state: state || 'Unknown',
        latitude: latitude,
        longitude: longitude,
        elevation: elevation ? parseInt(elevation) : null,
        type: 'custom',
        description: description || '',
        isPopular: false,
        isCustom: true,
        createdAt: Date.now()
      };
      
      // Save to database
      // Add to memory (JSON locations array)
      this.allLocations.push(newLocation);
      
      // Save to JSON file
      await this.saveLocationsToJSON();
      
      // Refresh the location dropdown
      this.populateLocationDropdown();
      
      // Auto-select the new location
      const locationSelect = document.getElementById('listLocationSelect');
      if (locationSelect) {
        locationSelect.value = newLocation.id;
        // Trigger change event to validate form
        locationSelect.dispatchEvent(new Event('change'));
      }
      
      // Hide the custom location fields
      this.hideCustomLocationFields();
      
      this.showToast(`Location "${name}" added successfully!`, 'success');
      vibrate([100, 100, 100]);
      
    } catch (error) {
      console.error('Error adding custom location:', error);
      this.showToast('Error adding location', 'error');
    }
  }

  // List management
  async createNewList() {
    const name = document.getElementById('listNameInput').value;
    const date = document.getElementById('listDateInput').value;
    const startTime = document.getElementById('listStartTimeInput').value;
    const customLocationFields = document.getElementById('customLocationFields');
    const locationId = document.getElementById('listLocationSelect').value;

    // Check if custom location fields are visible
    const isCustomLocationVisible = customLocationFields && !customLocationFields.classList.contains('hidden');

    if (!name || !date || !startTime) {
      this.showToast('Please fill in all required fields', 'error');
      return;
    }

    let location;

    if (isCustomLocationVisible) {
      // If custom location fields are visible, validate them first
      const customName = document.getElementById('customLocationName').value.trim();
      const customLat = document.getElementById('customLocationLat').value.trim();
      const customLng = document.getElementById('customLocationLng').value.trim();

      if (!customName || !customLat || !customLng) {
        this.showToast('Please complete the custom location details or cancel to select from existing locations', 'error');
        return;
      }

      // Use the custom location data directly
      const latitude = parseFloat(customLat);
      const longitude = parseFloat(customLng);
      const city = document.getElementById('customLocationCity').value.trim();
      const state = document.getElementById('customLocationState').value.trim();
      const elevation = document.getElementById('customLocationElevation').value.trim();
      const description = document.getElementById('customLocationDescription').value.trim();

      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        this.showToast('Invalid latitude. Must be between -90 and 90', 'error');
        return;
      }

      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        this.showToast('Invalid longitude. Must be between -180 and 180', 'error');
        return;
      }

      // Save custom location first
      try {
        await this.saveInlineCustomLocation();
        // The location is now selected in the dropdown, get its ID
        const selectedLocationId = document.getElementById('listLocationSelect').value;
        location = this.getLocationById(selectedLocationId);
      } catch (error) {
        console.error('Error saving custom location:', error);
        this.showToast('Error saving custom location', 'error');
        return;
      }
    } else {
      // Regular location selection
      if (!locationId) {
        this.showToast('Please select a location', 'error');
        return;
      }

      location = this.getLocationById(locationId);
      if (!location) {
        this.showToast('Please select a valid location', 'error');
        return;
      }
    }

    // Combine date and time
    const dateTimeString = `${date}T${startTime}`;
    const dateTime = new Date(dateTimeString);

    const newList = {
      name,
      dateTime: dateTime.getTime(),
      startTime: startTime,
      date: date,
      status: 'active',
      location: {
        id: location.id,
        name: location.name,
        city: location.city,
        state: location.state,
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
        type: location.type,
        description: location.description
      },
      createdAt: Date.now()
    };

    try {
      await this.addToStore('lists', newList);
      await this.loadData();
      this.hideModal('createListModal');
      this.clearForm('createListForm');
      
      // Reset custom location fields state
      this.hideCustomLocationFields();
      
      this.showToast('List created successfully!', 'success');
      vibrate([100, 100, 100]);
    } catch (error) {
      console.error('Error creating list:', error);
      this.showToast('Error creating list', 'error');
    }
  }

  // Render lists
  renderLists() {
    const activeContainer = document.getElementById('activeListsContent');
    const closedContainer = document.getElementById('closedListsContent');

    if (!activeContainer || !closedContainer) return;

    const activeLists = this.lists.filter(list => list.status === 'active');
    const closedLists = this.lists.filter(list => list.status === 'closed')
                                 .sort((a, b) => b.createdAt - a.createdAt);

    console.log(`Rendering lists: ${activeLists.length} active, ${closedLists.length} closed`);

    // Clear and render active lists
    activeContainer.innerHTML = '';
    if (activeLists.length === 0) {
      activeContainer.innerHTML = `
        <div class="empty-state-enhanced">
          <div class="empty-state-icon">📋</div>
          <h4>No Active Lists</h4>
          <p>Create your first butterfly observation list to get started!</p>
          <button class="create-list-prompt primary-btn" onclick="document.getElementById('createListBtn').click()">
            + Create New List
          </button>
        </div>`;
    } else {
      const fragment = document.createDocumentFragment();
      activeLists.forEach(list => {
        const listCard = this.createListCard(list);
        fragment.appendChild(listCard);
      });
      activeContainer.appendChild(fragment);
    }

    // Clear and render closed lists
    closedContainer.innerHTML = '';
    if (closedLists.length === 0) {
      closedContainer.innerHTML = `
        <div class="empty-state-enhanced">
          <div class="empty-state-icon">📁</div>
          <h4>No Closed Lists</h4>
          <p>All closed butterfly observation lists will appear here.</p>
        </div>`;
    } else {
      const fragment = document.createDocumentFragment();
      closedLists.forEach(list => {
        const listCard = this.createListCard(list);
        fragment.appendChild(listCard);
      });
      closedContainer.appendChild(fragment);
    }

    // Add a small delay to ensure all DOM operations are complete
    setTimeout(() => {
      console.log('Lists rendering complete. DOM ready for interactions.');
    }, 10);
  }

  // Helper function to format date/time in Indian format (dd-Mon-yyyy) with IST timezone
  formatIndianDateTime(date) {
    const options = {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const parts = formatter.formatToParts(date);
    
    const day = parts.find(part => part.type === 'day').value;
    const month = parts.find(part => part.type === 'month').value;
    const year = parts.find(part => part.type === 'year').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const dayPeriod = parts.find(part => part.type === 'dayPeriod').value;
    
    return {
      date: `${day}-${month}-${year}`,
      time: `${hour}:${minute} ${dayPeriod}`,
      fullDateTime: `${day}-${month}-${year} ${hour}:${minute} ${dayPeriod}`
    };
  }

  // Create list card
  createListCard(list) {
    const card = document.createElement('div');
    card.className = 'list-card';
    // Add data attribute for styling differentiation and unique identifier
    card.setAttribute('data-list-status', list.status);
    card.setAttribute('data-list-id', list.id);
    
    const date = new Date(list.dateTime);
    const indianDateTime = this.formatIndianDateTime(date);
    const observations = this.observations.filter(obs => obs.listId === list.id);
    const uniqueSpecies = new Set(observations.map(obs => obs.butterflyId)).size;
    const totalCount = observations.reduce((sum, obs) => sum + obs.count, 0);

    // Calculate species data for display
    const speciesCount = new Map();
    observations.forEach(obs => {
      const butterfly = getButterflyById(obs.butterflyId);
      const name = butterfly ? butterfly.commonName : 'Unknown';
      speciesCount.set(name, (speciesCount.get(name) || 0) + obs.count);
    });

    const sortedSpecies = Array.from(speciesCount.entries()).sort((a, b) => b[1] - a[1]);
    
    // Calculate rare species
    const rareObservations = observations.filter(obs => obs.isRare === true || obs.speciesType === 'rare');
    const rareSpeciesNames = [...new Set(rareObservations.map(obs => obs.butterflyName))];
    const rareSpeciesText = rareSpeciesNames.length > 0 ? rareSpeciesNames.join(', ') : 'None';

    // Get unique species list for closed lists display
    let uniqueSpeciesList = '';
    if (list.status === 'closed' && sortedSpecies.length > 0) {
      const displaySpecies = sortedSpecies.slice(0, 10); // Show top 10 species
      uniqueSpeciesList = displaySpecies.map(([name, count]) => `${name} (${count})`).join(', ');
      if (sortedSpecies.length > 10) {
        uniqueSpeciesList += ` and ${sortedSpecies.length - 10} more species`;
      }
    }

    card.innerHTML = `
      <div class="list-content">
        <div class="list-info">
          <div class="list-header">
            <h4 class="list-name ${list.status === 'active' ? 'clickable' : ''}">${list.name}</h4>
            <span class="list-status-badge ${list.status === 'closed' ? 'closed' : ''}">${list.status}</span>
          </div>
          <div class="list-meta">
            <p class="list-date">${indianDateTime.date}</p>
            <p class="list-time-info">Start: ${list.startTime || indianDateTime.time}${list.endTime ? ` • End: ${list.endTime}` : ''}</p>
            ${list.location ? `<p class="list-location">📍 ${list.location.name}${list.location.city ? ` (${list.location.city})` : ''}${list.location.elevation ? ` • ${list.location.elevation}m` : ''}</p>` : ''}
            ${list.status === 'closed' && list.closedAt ? `<p class="list-closed">Closed: ${this.formatIndianDateTime(new Date(list.closedAt)).date}</p>` : ''}
            ${rareSpeciesNames.length > 0 ? `<p class="list-rare-species">🔍 Rare Species: ${rareSpeciesText}</p>` : ''}
            ${list.status === 'closed' && uniqueSpeciesList ? `<p class="list-species-summary">🦋 Species: ${uniqueSpeciesList}</p>` : ''}
          </div>
          <div class="list-stats">
            <div class="stat-card-compact">
              <span class="stat-number">${uniqueSpecies}</span>
              <span class="stat-label">Unique Species</span>
            </div>
            <div class="stat-card-compact">
              <span class="stat-number">${totalCount}</span>
              <span class="stat-label">Total Count</span>
            </div>
          </div>
        </div>
        <div class="list-actions">
          ${list.status === 'active' ? 
            `<button class="action-btn add-observations primary-btn" data-list-id="${list.id}" data-action="add-observations">🦋 Add Observations</button>
             <button class="action-btn view-details secondary-btn" data-list-id="${list.id}" data-action="view-details">📊 View Details</button>
             <button class="action-btn close-list tertiary-btn" data-list-id="${list.id}" data-action="close-list">✅ Close List</button>` :
            `<div class="closed-list-actions">
              <button class="action-btn view-stats primary-btn" data-list-id="${list.id}" data-action="view-stats">📊 View Stats</button>
              <button class="action-btn download-csv secondary-btn" data-list-id="${list.id}" data-action="download-csv">📥 Download CSV</button>
              <button class="action-btn download-html tertiary-btn" data-list-id="${list.id}" data-action="download-html">📄 Download HTML</button>
            </div>`
          }
        </div>
      </div>
    `;

    // Debug: Log the generated HTML to understand button structure
    console.log('Generated HTML for list card:', list.name);
    console.log('Card innerHTML preview:', card.innerHTML.substring(0, 500) + '...');

    // Wait for next tick to ensure DOM is fully updated
    setTimeout(() => {
      this.attachListCardEventHandlers(card, list);
    }, 0);

    return card;
  }

  // Separate method for attaching event handlers to avoid timing issues
  attachListCardEventHandlers(card, list) {
    console.log(`=== Setting up event handlers for ${list.status} list: ${list.name} ===`);
    
    // Get all action buttons for comprehensive debugging
    const allActionBtns = card.querySelectorAll('.action-btn');
    const listActions = card.querySelector('.list-actions, .closed-list-actions');
    
    console.log('Button analysis:', {
      listId: list.id,
      listStatus: list.status,
      totalButtons: allActionBtns.length,
      buttonContainer: listActions ? listActions.className : 'not found',
      buttonDetails: Array.from(allActionBtns).map((btn, index) => ({
        index,
        class: btn.className,
        action: btn.getAttribute('data-action'),
        text: btn.textContent?.trim(),
        bounds: btn.getBoundingClientRect(),
        listId: btn.getAttribute('data-list-id')
      }))
    });

    // Add direct event listeners to each button individually
    allActionBtns.forEach((button, index) => {
      const action = button.getAttribute('data-action');
      const buttonListId = button.getAttribute('data-list-id');
      
      console.log(`Adding direct listener to button ${index}:`, {
        action,
        buttonListId,
        text: button.textContent?.trim()
      });
      
      // Remove any existing listeners by cloning the button
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // Add fresh event listener
      newButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Ensure this is the direct target of the click
        if (e.target !== newButton && !newButton.contains(e.target)) {
          return;
        }
        
        console.log(`🎯 DIRECT BUTTON CLICK: ${action} for list ${list.name}`);
        
        switch (action) {
          case 'add-observations':
            console.log('✅ Executing Add Observations');
            this.selectedCountViewList = list.id;
            this.switchView('count');
            this.updateCountViewListSelector();
            break;
            
          case 'view-details':
            console.log('✅ Executing View Details');
            this.showListStats(list);
            break;
            
          case 'close-list':
            console.log('✅ Executing Close List');
            this.closeList(list.id);
            break;
            
          case 'view-stats':
            console.log('✅ Executing View Stats');
            this.showListStats(list);
            break;
            
          case 'download-csv':
            console.log('✅ Executing Download CSV');
            this.downloadListCSV(list.id);
            break;
            
          case 'download-html':
            console.log('✅ Executing Download HTML');
            // Pass the list object directly to ensure consistency with View Stats
            this.generateHTMLReport(list);
            break;
            
          default:
            console.warn('❌ Unknown action:', action);
        }
      }, { passive: false });
      
      // Add touch event for mobile
      if (this.isMobileDevice()) {
        newButton.addEventListener('touchstart', (e) => {
          console.log(`📱 Touch start on button: ${action}`);
          newButton.style.transform = 'scale(0.95)';
          newButton.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
        }, { passive: true });
        
        newButton.addEventListener('touchend', (e) => {
          console.log(`📱 Touch end on button: ${action}`);
          setTimeout(() => {
            newButton.style.transform = '';
            newButton.style.backgroundColor = '';
          }, 100);
        }, { passive: true });
      }
    });

    // Add card-level debugging (but no functionality)
    card.addEventListener('click', (e) => {
      const target = e.target;
      const isButton = target.closest('.action-btn');
      
      console.log('🔍 Card click debug:', {
        isButton: !!isButton,
        targetTag: target.tagName,
        targetClass: target.className,
        targetText: target.textContent?.trim().substring(0, 30),
        clickPosition: {
          x: e.clientX,
          y: e.clientY
        },
        buttonBounds: Array.from(allActionBtns).map(btn => ({
          action: btn.getAttribute('data-action'),
          bounds: btn.getBoundingClientRect()
        }))
      });
      
      // Only allow card functionality if NOT clicking on buttons
      if (!isButton) {
        console.log('Card area clicked (non-button)');
        // Card-level functionality can go here if needed
      } else {
        console.log('Button area clicked - should be handled by button listener');
      }
    }, { passive: false });
  }

  // Helper method to detect mobile devices
  isMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     ('ontouchstart' in window) ||
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    
    // Log mobile detection for debugging
    if (isMobile) {
      console.log('Mobile device detected:', {
        userAgent: navigator.userAgent,
        hasTouch: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pixelRatio: window.devicePixelRatio
      });
    }
    
    return isMobile;
  }

  // Close list
  async closeList(listId) {
    try {
      const list = this.lists.find(l => l.id === listId);
      if (list) {
        // Show confirmation modal first instead of immediately closing
        this.showCloseListConfirmationModal(list);
      }
    } catch (error) {
      console.error('Error showing close list confirmation:', error);
      this.showToast('Error showing confirmation dialog', 'error');
    }
  }

  // Show close list confirmation modal with summary
  showCloseListConfirmationModal(list) {
    const modal = document.getElementById('listStatsModal');
    const titleElement = document.getElementById('statsModalTitle');
    const contentElement = document.getElementById('statsModalContent');

    const observations = this.observations.filter(obs => obs.listId === list.id);
    const speciesCount = new Map();
    
    observations.forEach(obs => {
      const butterfly = getButterflyById(obs.butterflyId);
      const name = butterfly ? butterfly.commonName : 'Unknown';
      speciesCount.set(name, (speciesCount.get(name) || 0) + obs.count);
    });

    const sortedSpecies = Array.from(speciesCount.entries())
                               .sort((a, b) => b[1] - a[1]);

    const uniqueSpecies = speciesCount.size;
    const totalCount = Array.from(speciesCount.values()).reduce((sum, count) => sum + count, 0);
    const highestCount = sortedSpecies.length > 0 ? sortedSpecies[0] : null;
    const lowestCount = sortedSpecies.length > 0 ? sortedSpecies[sortedSpecies.length - 1] : null;

    // Calculate time span and interval data
    let timeSpan = 'N/A';
    let firstObsTime = null;
    let lastObsTime = null;
    let intervalData = [];
    
    if (observations.length > 0) {
      const times = observations.map(obs => new Date(obs.dateTime)).sort((a, b) => a - b);
      firstObsTime = times[0];
      lastObsTime = times[times.length - 1];
      
      if (observations.length > 1) {
        const duration = lastObsTime - firstObsTime;
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        timeSpan = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }
      
      // Generate 30-minute interval data
      intervalData = this.generate30MinuteIntervalData(observations, firstObsTime, lastObsTime);
    }

    if (titleElement) {
      titleElement.textContent = `Close "${list.name}"?`;
    }

    if (contentElement) {
      const chartId = `closeChart_${list.id}_${Date.now()}`;
      contentElement.innerHTML = `
        <div class="summary-header">
          <h4>📊 List Summary</h4>
          <p class="summary-subtitle">Review your observations before closing this list</p>
        </div>
        
        <div class="stats-overview">
          <div class="stat-item">
            <span class="stat-number">${uniqueSpecies}</span>
            <span class="stat-label">Unique Species</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${totalCount}</span>
            <span class="stat-label">Total Butterflies</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${observations.length}</span>
            <span class="stat-label">Observations</span>
          </div>
          ${intervalData.length > 0 ? `
          <div class="stat-item">
            <span class="stat-number">${timeSpan}</span>
            <span class="stat-label">Duration</span>
          </div>
          ` : ''}
        </div>
        
        <div class="stats-details">
          <div class="detail-section">
            <h4>📅 Date & Time</h4>
            <p>${this.formatIndianDateTime(new Date(list.dateTime)).fullDateTime} IST</p>
            ${firstObsTime && lastObsTime && observations.length > 1 ? `
              <p><strong>First Observation:</strong> ${this.formatIndianDateTime(firstObsTime).time}</p>
              <p><strong>Last Observation:</strong> ${this.formatIndianDateTime(lastObsTime).time}</p>
            ` : ''}
          </div>
          
          ${highestCount ? `
            <div class="detail-section">
              <h4>🏆 Most Observed</h4>
              <p>${highestCount[0]} (${highestCount[1]} butterflies)</p>
            </div>
          ` : ''}
          
          ${lowestCount && lowestCount !== highestCount ? `
            <div class="detail-section">
              <h4>🔍 Least Observed</h4>
              <p>${lowestCount[0]} (${lowestCount[1]} butterflies)</p>
            </div>
          ` : ''}
        </div>
        
        ${intervalData.length > 0 ? `
          <div class="detail-section">
            <h4>📊 30-Minute Activity Analysis</h4>
            <div class="interval-chart-container" style="margin: 1rem 0; padding: 1rem; background: var(--surface-color); border-radius: 8px; border: 1px solid var(--border-color);">
              <canvas id="intervalChart_${chartId}" width="800" height="300" style="max-width: 100%; height: 300px;"></canvas>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>📋 Time Interval Breakdown</h4>
            <div class="interval-table" style="display: block; overflow-x: auto; margin: 1rem 0;">
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 2fr; gap: 0.5rem; min-width: 600px;">
                <div class="table-header" style="display: contents;">
                  <div class="col-time" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center; border-radius: 4px 0 0 0;">Time Range</div>
                  <div class="col-unique" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center;">Unique Species</div>
                  <div class="col-total" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center;">Total Count</div>
                  <div class="col-common" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center; border-radius: 0 4px 0 0;">Most Common Species</div>
                </div>
                ${intervalData.map((interval, index) => `
                  <div class="table-row" style="display: contents;">
                    <div class="col-time" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color);">${interval.timeRange}</div>
                    <div class="col-unique" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); font-weight: 600; color: ${interval.uniqueSpecies > 0 ? 'var(--success-color)' : 'var(--text-secondary)'};">${interval.uniqueSpecies}</div>
                    <div class="col-total" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); font-weight: 600; color: ${interval.totalCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)'};">${interval.totalCount}</div>
                    <div class="col-common" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">${interval.mostCommon || 'None'}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}
        
        <div class="species-breakdown">
          <h4>Species Breakdown</h4>
          <div class="species-list">
            ${sortedSpecies.map(([name, count]) => `
              <div class="species-item">
                <span class="species-name">${name}</span>
                <span class="species-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="confirmation-section">
          <p style="text-align: center; margin: 1.5rem 0; font-weight: 600; color: var(--text-secondary);">
            Are you sure you want to close this list? This action cannot be undone.
          </p>
          <div class="confirmation-actions" style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
            <button id="confirmCloseList" class="primary-btn" data-list-id="${list.id}" style="background: #dc3545; border: none;">
              🔒 Close the List
            </button>
            <button id="cancelCloseList" class="secondary-btn">
              ❌ Do Not Close the List
            </button>
          </div>
        </div>
      `;

      // Add event listeners for confirmation buttons
      const confirmBtn = contentElement.querySelector('#confirmCloseList');
      const cancelBtn = contentElement.querySelector('#cancelCloseList');
      
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          await this.confirmCloseList(list.id);
          this.hideModal('listStatsModal');
        });
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.hideModal('listStatsModal');
        });
      }

      // Create interval chart after modal is shown
      if (intervalData.length > 0) {
        setTimeout(() => {
          this.createIntervalChart(`intervalChart_${chartId}`, intervalData);
        }, 100);
      }
    }

    // Hide the modal footer (which contains HTML download button) for close confirmation
    const modalFooter = modal.querySelector('.modal-footer');
    if (modalFooter) {
      modalFooter.style.display = 'none';
    }

    // Ensure the existing modal close button works properly
    const existingCloseBtn = modal.querySelector('.modal-close');
    if (existingCloseBtn) {
      // Remove any existing listeners and add a fresh one
      existingCloseBtn.replaceWith(existingCloseBtn.cloneNode(true));
      const newCloseBtn = modal.querySelector('.modal-close');
      newCloseBtn.addEventListener('click', () => {
        this.hideModal('listStatsModal');
      });
    }

    this.showModal('listStatsModal');
  }

  // Actually close the list after confirmation
  async confirmCloseList(listId) {
    try {
      const list = this.lists.find(l => l.id === listId);
      if (list) {
        const now = new Date();
        list.status = 'closed';
        list.closedAt = Date.now();
        list.endTime = now.toTimeString().slice(0, 5);
        list.endDate = now.toISOString().split('T')[0];
        
        await this.updateInStore('lists', list);
        await this.loadData();
        
        // Update count view list selector if we're on count view
        if (this.currentView === 'count') {
          this.updateCountViewListSelector();
        }
        
        // Show success message
        this.showToast('List closed successfully! 🎉', 'success');
        
        // Optionally show the final summary modal
        setTimeout(() => {
          this.showListSummaryModal(list);
        }, 500);
      }
    } catch (error) {
      console.error('Error closing list:', error);
      this.showToast('Error closing list', 'error');
    }
  }

  // Show list statistics with enhanced metrics and pie chart
  showListStats(list) {
    console.log('showListStats called for list:', list.name, 'with ID:', list.id);
    
    // Store current list ID for report generation
    this.currentDisplayedListId = list.id;
    
    const modal = document.getElementById('listStatsModal');
    const titleElement = document.getElementById('statsModalTitle');
    const contentElement = document.getElementById('statsModalContent');

    console.log('Modal elements found:', {
      modal: !!modal,
      titleElement: !!titleElement,
      contentElement: !!contentElement
    });

    const observations = this.observations.filter(obs => obs.listId === list.id);
    console.log('Filtered observations for list:', observations.length, 'observations');
    
    const speciesCount = new Map();
    const familyCount = new Map();
    const timeOfDayCount = new Map();
    const rareSpeciesSet = new Set(); // Track unique rare species
    
    observations.forEach(obs => {
      const butterfly = getButterflyById(obs.butterflyId);
      const name = butterfly ? butterfly.commonName : 'Unknown';
      const family = butterfly ? butterfly.family : 'Unknown';
      
      speciesCount.set(name, (speciesCount.get(name) || 0) + obs.count);
      familyCount.set(family, (familyCount.get(family) || 0) + obs.count);
      
      // Track unique rare species
      if (obs.isRare === true || obs.speciesType === 'rare') {
        rareSpeciesSet.add(name);
      }
      
      // Track time of day patterns using 30-minute intervals
      if (obs.obsTime) {
        try {
          const [hour, minute] = obs.obsTime.split(':').map(Number);
          
          // Validate hour and minute values
          if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            // Convert to 30-minute intervals
            const totalMinutes = hour * 60 + minute;
            const intervalStart = Math.floor(totalMinutes / 30) * 30;
            const startHour = Math.floor(intervalStart / 60);
            const startMinute = intervalStart % 60;
            const endMinutes = intervalStart + 30;
            const endHour = Math.floor(endMinutes / 60);
            const endMinute = endMinutes % 60;
            
            const formatTime = (h, m) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            const timeSlot = `${formatTime(startHour, startMinute)}-${formatTime(endHour, endMinute)}`;
            
            timeOfDayCount.set(timeSlot, (timeOfDayCount.get(timeSlot) || 0) + obs.count);
          }
        } catch (error) {
          console.warn('Invalid time format for observation:', obs.obsTime);
        }
      }
    });

    const sortedSpecies = Array.from(speciesCount.entries()).sort((a, b) => b[1] - a[1]);
    const sortedFamilies = Array.from(familyCount.entries()).sort((a, b) => b[1] - a[1]);
    const sortedTimeSlots = Array.from(timeOfDayCount.entries()).sort((a, b) => b[1] - a[1]);

    const uniqueSpecies = speciesCount.size;
    const totalCount = Array.from(speciesCount.values()).reduce((sum, count) => sum + count, 0);
    const uniqueFamilies = familyCount.size;
    const rareSpeciesCount = rareSpeciesSet.size; // Count of unique rare species
    const highestCount = sortedSpecies.length > 0 ? sortedSpecies[0] : null;
    const lowestCount = sortedSpecies.length > 0 ? sortedSpecies[sortedSpecies.length - 1] : null;

    // Calculate observation time span and other time-related data for closed lists
    let timeSpan = 'N/A';
    let firstObsTime = null;
    let lastObsTime = null;
    let intervalData = [];
    
    if (observations.length > 0) {
      const times = observations.map(obs => new Date(obs.dateTime)).sort((a, b) => a - b);
      firstObsTime = times[0];
      lastObsTime = times[times.length - 1];
      
      if (observations.length > 1) {
        const duration = lastObsTime - firstObsTime;
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        timeSpan = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }
      
      // Generate 30-minute interval data for closed lists
      if (list.status === 'closed') {
        intervalData = this.generate30MinuteIntervalData(observations, firstObsTime, lastObsTime);
      }
    }

    if (titleElement) {
      titleElement.textContent = `${list.name} - Detailed Statistics`;
      console.log('Title element updated with:', titleElement.textContent);
    }

    if (contentElement) {
      console.log('Populating content element with stats...');
      const chartId = `pieChart_${list.id}_${Date.now()}`;
      contentElement.innerHTML = `
        <div class="stats-overview-enhanced">
          <div class="stat-row">
            <div class="stat-item">
              <span class="stat-number">${uniqueSpecies}</span>
              <span class="stat-label">Unique Species</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${totalCount}</span>
              <span class="stat-label">Total Count</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${observations.length}</span>
              <span class="stat-label">Observations</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${uniqueFamilies}</span>
              <span class="stat-label">Families</span>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat-item">
              <span class="stat-number">${rareSpeciesCount}</span>
              <span class="stat-label">Rare Species</span>
            </div>
            ${list.status === 'closed' ? `
            <div class="stat-item">
              <span class="stat-number">${timeSpan}</span>
              <span class="stat-label">Total Duration</span>
            </div>
            ` : `
            <div class="stat-item">
              <span class="stat-number">Active</span>
              <span class="stat-label">Status</span>
            </div>
            `}
          </div>
        </div>
        
        <div class="chart-container">
          <h4>🥧 Top 10 Species by Count</h4>
          <canvas id="${chartId}" width="400" height="400"></canvas>
        </div>
        
        <div class="stats-details-enhanced">
          <div class="detail-section">
            <h4>📋 List Information</h4>
            <p><strong>Created:</strong> ${this.formatIndianDateTime(new Date(list.dateTime)).fullDateTime} IST</p>
            ${list.status === 'closed' && list.closedAt ? `
              <p><strong>Closed:</strong> ${this.formatIndianDateTime(new Date(list.closedAt)).fullDateTime} IST</p>
              <p><strong>Total Duration:</strong> ${timeSpan}</p>
              ${firstObsTime && lastObsTime ? `
                <p><strong>First Observation:</strong> ${this.formatIndianDateTime(firstObsTime).time}</p>
                <p><strong>Last Observation:</strong> ${this.formatIndianDateTime(lastObsTime).time}</p>
              ` : ''}
            ` : ''}
          </div>
          
          ${list.status === 'closed' && intervalData.length > 0 ? `
            <div class="detail-section">
              <h4>📊 Active Observation Periods (30-min intervals)</h4>
              <p style="color: var(--text-secondary); font-size: 0.9em; margin: 0.5rem 0;">
                <em>Chart shows only 30-minute periods where observations were recorded, optimized for better readability.</em>
              </p>
              <div class="interval-chart-container" style="margin: 1rem 0; padding: 1rem; background: var(--surface-color); border-radius: 8px; border: 1px solid var(--border-color);">
                <canvas id="intervalChart_${list.id}_${chartId.split('_')[2]}" width="800" height="400" style="max-width: 100%; height: 400px;"></canvas>
              </div>
            </div>
            
            <div class="detail-section">
              <h4>📋 Time Interval Breakdown</h4>
              <div class="interval-table" style="display: block; overflow-x: auto; margin: 1rem 0;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 2fr; gap: 0.5rem; min-width: 600px;">
                  <div class="table-header" style="display: contents;">
                    <div class="col-time" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center; border-radius: 4px 0 0 0;">Time Range</div>
                    <div class="col-unique" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center;">Unique Species</div>
                    <div class="col-total" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center;">Total Count</div>
                    <div class="col-common" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center; border-radius: 0 4px 0 0;">Most Common Species</div>
                  </div>
                  ${intervalData.map((interval, index) => `
                    <div class="table-row" style="display: contents;">
                      <div class="col-time" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color);">${interval.timeRange}</div>
                      <div class="col-unique" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); font-weight: 600; color: ${interval.uniqueSpecies > 0 ? 'var(--success-color)' : 'var(--text-secondary)'};">${interval.uniqueSpecies}</div>
                      <div class="col-total" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); font-weight: 600; color: ${interval.totalCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)'};">${interval.totalCount}</div>
                      <div class="col-common" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">${interval.mostCommon || 'None'}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}
          
          ${highestCount ? `
            <div class="detail-section">
              <h4>🏆 Most Observed Species</h4>
              <p>${highestCount[0]} - ${highestCount[1]} butterflies</p>
            </div>
          ` : ''}
          
          ${sortedTimeSlots.length > 0 ? `
            <div class="detail-section">
              <h4>⏰ Peak Activity Time</h4>
              <p><strong>${sortedTimeSlots[0][0]}</strong></p>
              <p>${sortedTimeSlots[0][1]} observation${sortedTimeSlots[0][1] !== 1 ? 's' : ''} recorded</p>
              ${sortedTimeSlots.length > 1 && sortedTimeSlots[1][1] === sortedTimeSlots[0][1] ? 
                `<p class="activity-note">Tied with ${sortedTimeSlots[1][0]}</p>` : 
                sortedTimeSlots.length > 1 ? 
                `<p class="activity-note">Runner-up: ${sortedTimeSlots[1][0]} (${sortedTimeSlots[1][1]} observation${sortedTimeSlots[1][1] !== 1 ? 's' : ''})</p>` : ''
              }
              <p class="activity-note">Shows only 30-minute periods with observations</p>
            </div>
          ` : ''}
          
          ${sortedFamilies.length > 0 ? `
            <div class="detail-section">
              <h4>🦋 Most Common Family</h4>
              <p>${sortedFamilies[0][0]} - ${sortedFamilies[0][1]} butterflies</p>
            </div>
          ` : ''}
        </div>
        
        <div class="species-breakdown-enhanced">
          <h4>📊 All Species Breakdown</h4>
          <div class="species-list-enhanced">
            ${sortedSpecies.map(([ name, count], index) => {
              const percentage = ((count / totalCount) * 100).toFixed(1);
              return `
                <div class="species-item-enhanced">
                  <span class="species-rank">#${index + 1}</span>
                  <span class="species-name">${name}</span>
                  <span class="species-count">${count}</span>
                  <span class="species-percentage">${percentage}%</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        ${sortedFamilies.length > 1 ? `
          <div class="family-breakdown">
            <h4>🏠 Family Distribution</h4>
            <div class="family-list">
              ${sortedFamilies.map(([family, count]) => {
                const percentage = ((count / totalCount) * 100).toFixed(1);
                return `
                  <div class="family-item">
                    <span class="family-name">${family}</span>
                    <span class="family-count">${count} (${percentage}%)</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      `;
      
      console.log('Content element innerHTML set. Length:', contentElement.innerHTML.length);

      // Create pie chart after DOM is updated
      setTimeout(() => {
        console.log('Creating charts...');
        this.createPieChart(chartId, sortedSpecies.slice(0, 10));
        
        // Create interval chart for closed lists
        if (list.status === 'closed' && intervalData.length > 0) {
          const intervalChartId = `intervalChart_${list.id}_${chartId.split('_')[2]}`;
          console.log('Creating interval chart with ID:', intervalChartId);
          console.log('Interval data:', intervalData);
          this.createIntervalChart(intervalChartId, intervalData);
        } else {
          console.log('No interval chart needed:', { 
            isClosed: list.status === 'closed', 
            hasIntervalData: intervalData.length > 0,
            intervalDataLength: intervalData.length 
          });
        }
      }, 100);
    }

    // Ensure the modal footer is visible for regular stats (not close confirmation)
    const modalFooter = modal?.querySelector('.modal-footer');
    if (modalFooter) {
      modalFooter.style.display = 'flex';
    }

    console.log('About to show modal: listStatsModal');
    this.showModal('listStatsModal');
  }

  // Create pie chart for top species
  createPieChart(canvasId, speciesData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) {
      console.error('Chart.js not loaded or canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    
    // Generate colors for the pie chart
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ];

    const chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: speciesData.map(([name]) => name),
        datasets: [{
          data: speciesData.map(([, count]) => count),
          backgroundColor: colors.slice(0, speciesData.length),
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    // Store chart reference for cleanup
    canvas.chartInstance = chart;
  }

  // Generate 30-minute interval data for observations
  generate30MinuteIntervalData(observations, firstObsTime, lastObsTime) {
    if (!observations.length || !firstObsTime || !lastObsTime) return [];

    const intervalMs = 30 * 60 * 1000; // 30 minutes in milliseconds
    const intervalMap = new Map(); // Use Map to store intervals with observations
    
    // Format time range helper
    const formatTime = (date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };
    
    // Process each observation and assign it to a 30-minute interval
    observations.forEach(obs => {
      const obsTime = new Date(obs.dateTime);
      
      // Round down to nearest 30-minute mark to get interval start
      const intervalStart = new Date(obsTime);
      intervalStart.setMinutes(Math.floor(intervalStart.getMinutes() / 30) * 30, 0, 0);
      
      const intervalEnd = new Date(intervalStart.getTime() + intervalMs);
      const intervalKey = intervalStart.getTime(); // Use timestamp as key
      
      // Get or create interval data
      if (!intervalMap.has(intervalKey)) {
        const startStr = formatTime(intervalStart);
        const endStr = formatTime(intervalEnd);
        
        intervalMap.set(intervalKey, {
          startTime: new Date(intervalStart),
          endTime: new Date(intervalEnd),
          timeRange: `${startStr} - ${endStr}`,
          observations: [],
          speciesSet: new Set(),
          speciesCount: new Map()
        });
      }
      
      const interval = intervalMap.get(intervalKey);
      
      // Add observation to interval
      interval.observations.push(obs);
      interval.speciesSet.add(obs.butterflyName);
      interval.speciesCount.set(
        obs.butterflyName, 
        (interval.speciesCount.get(obs.butterflyName) || 0) + obs.count
      );
    });
    
    // Convert map to array and calculate final stats
    const intervalData = Array.from(intervalMap.values()).map(interval => {
      // Calculate total count
      const totalCount = interval.observations.reduce((sum, obs) => sum + obs.count, 0);
      
      // Find most common species
      let mostCommonSpecies = null;
      let maxCount = 0;
      interval.speciesCount.forEach((count, species) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonSpecies = `${species} (${count})`;
        }
      });
      
      return {
        startTime: interval.startTime,
        endTime: interval.endTime,
        timeRange: interval.timeRange,
        uniqueSpecies: interval.speciesSet.size,
        totalCount: totalCount,
        mostCommon: mostCommonSpecies,
        observations: interval.observations.length
      };
    });
    
    // Sort by start time to ensure chronological order
    intervalData.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    return intervalData;
  }

  // Create interval trend chart
  createIntervalChart(canvasId, intervalData) {
    console.log('createIntervalChart called with:', { canvasId, intervalData });
    const canvas = document.getElementById(canvasId);
    console.log('Canvas found:', !!canvas);
    console.log('Chart.js loaded:', !!window.Chart);
    
    if (!canvas || !window.Chart || !intervalData.length) {
      console.error('Chart.js not loaded, canvas not found, or no interval data', {
        canvasFound: !!canvas,
        chartJsLoaded: !!window.Chart,
        intervalDataLength: intervalData.length
      });
      return;
    }

    const ctx = canvas.getContext('2d');
    
    // Prepare data for the chart
    const labels = intervalData.map(interval => interval.timeRange);
    const uniqueSpeciesData = intervalData.map(interval => interval.uniqueSpecies);
    const totalCountData = intervalData.map(interval => interval.totalCount);

    console.log('Chart data prepared:', { labels, uniqueSpeciesData, totalCountData });

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Unique Species',
            data: uniqueSpeciesData,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.1,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#4CAF50',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          },
          {
            label: 'Total Count',
            data: totalCountData,
            borderColor: '#FF9800',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.1,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#FF9800',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Active Observation Periods (30-min intervals)',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              maxRotation: 45,
              font: {
                size: 11
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'Count',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: {
                size: 11
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 12,
                weight: 'bold'
              },
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: function(context) {
                return `Time: ${context[0].label}`;
              },
              label: function(context) {
                const intervalIndex = context.dataIndex;
                const interval = intervalData[intervalIndex];
                const datasetLabel = context.dataset.label;
                const value = context.parsed.y;
                
                if (datasetLabel === 'Unique Species') {
                  return `${datasetLabel}: ${value} species`;
                } else {
                  return `${datasetLabel}: ${value} butterflies`;
                }
              },
              afterLabel: function(context) {
                const intervalIndex = context.dataIndex;
                const interval = intervalData[intervalIndex];
                
                if (context.datasetIndex === 0) { // Show additional info only once
                  return [
                    `Observations: ${interval.observations}`,
                    interval.mostCommon ? `Most Common: ${interval.mostCommon}` : 'Most Common: None'
                  ];
                }
                return null;
              }
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeOutQuart'
        }
      },
      plugins: [{
        afterDatasetsDraw: function(chart) {
          const ctx = chart.ctx;
          chart.data.datasets.forEach(function(dataset, i) {
            const meta = chart.getDatasetMeta(i);
            if (!meta.hidden) {
              meta.data.forEach(function(element, index) {
                // Draw value labels on points
                const dataString = dataset.data[index].toString();
                ctx.fillStyle = dataset.borderColor;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                
                const position = element.tooltipPosition();
                ctx.fillText(dataString, position.x, position.y - 5);
              });
            }
          });
        }
      }]
    });

    // Store chart reference for cleanup
    canvas.chartInstance = chart;
  }

  // Show list summary modal when closing a list
  showListSummaryModal(list) {
    const modal = document.getElementById('listStatsModal');
    const titleElement = document.getElementById('statsModalTitle');
    const contentElement = document.getElementById('statsModalContent');

    const observations = this.observations.filter(obs => obs.listId === list.id);
    const speciesCount = new Map();
    
    observations.forEach(obs => {
      const butterfly = getButterflyById(obs.butterflyId);
      const name = butterfly ? butterfly.commonName : 'Unknown';
      speciesCount.set(name, (speciesCount.get(name) || 0) + obs.count);
    });

    const sortedSpecies = Array.from(speciesCount.entries())
                               .sort((a, b) => b[1] - a[1]);

    const uniqueSpecies = speciesCount.size;
    const totalCount = Array.from(speciesCount.values()).reduce((sum, count) => sum + count, 0);
    const highestCount = sortedSpecies.length > 0 ? sortedSpecies[0] : null;
    const lowestCount = sortedSpecies.length > 0 ? sortedSpecies[sortedSpecies.length - 1] : null;

    // Generate 30-minute interval data
    const startDate = new Date(list.dateTime);
    const endDate = list.closedAt ? new Date(list.closedAt) : new Date();
    const intervalData = this.generate30MinuteIntervalData(observations, startDate, endDate);

    if (titleElement) {
      titleElement.textContent = `${list.name} - Summary`;
    }

    if (contentElement) {
      contentElement.innerHTML = `
        <div class="summary-header">
          <h4>🎉 List Successfully Closed!</h4>
          <p class="summary-subtitle">Here's a summary of your butterfly observations</p>
        </div>
        
        <div class="stats-overview">
          <div class="stat-item">
            <span class="stat-number">${uniqueSpecies}</span>
            <span class="stat-label">Unique Species</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${totalCount}</span>
            <span class="stat-label">Total Butterflies</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${observations.length}</span>
            <span class="stat-label">Observations</span>
          </div>
        </div>
        
        <div class="stats-details">
          <div class="detail-section">
            <h4>📅 Date & Time</h4>
            <p>${this.formatIndianDateTime(new Date(list.dateTime)).fullDateTime} IST</p>
          </div>
          
          ${list.closedAt ? `
            <div class="detail-section">
              <h4>🔚 Closed At</h4>
              <p>${this.formatIndianDateTime(new Date(list.closedAt)).fullDateTime} IST</p>
            </div>
          ` : ''}
          
          ${highestCount ? `
            <div class="detail-section">
              <h4>🏆 Most Observed</h4>
              <p>${highestCount[0]} (${highestCount[1]} butterflies)</p>
            </div>
          ` : ''}
          
          ${lowestCount && lowestCount !== highestCount ? `
            <div class="detail-section">
              <h4>🔍 Least Observed</h4>
              <p>${lowestCount[0]} (${lowestCount[1]} butterflies)</p>
            </div>
          ` : ''}
        </div>
        
        ${intervalData && intervalData.length > 0 ? `
          <div class="interval-analysis">
            <h4>📈 Active Observation Periods (30-min intervals)</h4>
            <p style="color: var(--text-secondary); font-size: 0.9em; margin: 0.5rem 0;">
              <em>Shows only 30-minute periods with recorded observations.</em>
            </p>
            <div class="chart-container">
              <canvas id="summaryIntervalChart" width="400" height="200"></canvas>
            </div>
            
            <div class="interval-table" style="margin-top: 1rem; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: grid; grid-template-columns: 1fr 1fr 1fr 2fr; gap: 0;">
              <div class="table-header" style="display: contents;">
                <div class="col-time" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center; border-radius: 4px 0 0 0;">Time Range</div>
                <div class="col-unique" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center;">Unique Species</div>
                <div class="col-total" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center;">Total Count</div>
                <div class="col-common" style="background: var(--primary-color); color: white; padding: 0.75rem; font-weight: 600; text-align: center; border-radius: 0 4px 0 0;">Most Common Species</div>
              </div>
              ${intervalData.map((interval, index) => `
                <div class="table-row" style="display: contents;">
                  <div class="col-time" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color);">${interval.timeRange}</div>
                  <div class="col-unique" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); font-weight: 600; color: ${interval.uniqueSpecies > 0 ? 'var(--success-color)' : 'var(--text-secondary)'};">${interval.uniqueSpecies}</div>
                  <div class="col-total" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); font-weight: 600; color: ${interval.totalCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)'};">${interval.totalCount}</div>
                  <div class="col-common" style="background: ${index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}; padding: 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">${interval.mostCommon || 'None'}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="download-section">
          <h4>📊 Export Data</h4>
          <p>Download your complete observation data as a CSV file for further analysis</p>
          <button id="downloadCSV" class="primary-btn" data-list-id="${list.id}">
            📥 Download CSV File
          </button>
        </div>
        
        <div class="species-breakdown">
          <h4>Species Breakdown</h4>
          <div class="species-list">
            ${sortedSpecies.map(([name, count]) => `
              <div class="species-item">
                <span class="species-name">${name}</span>
                <span class="species-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // Add event listener for CSV download
      const downloadBtn = contentElement.querySelector('#downloadCSV');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          this.downloadListCSV(list.id);
        });
      }
    }

    // Fix modal close button - clone and replace to remove old event listeners
    const originalCloseBtn = modal.querySelector('.modal-close');
    if (originalCloseBtn) {
      const newCloseBtn = originalCloseBtn.cloneNode(true);
      originalCloseBtn.parentNode.replaceChild(newCloseBtn, originalCloseBtn);
      
      newCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hideModal('listStatsModal');
      });
    }

    this.showModal('listStatsModal');
    
    // Create interval chart after modal is displayed
    if (intervalData && intervalData.length > 0) {
      setTimeout(() => {
        this.createIntervalChart('summaryIntervalChart', intervalData);
      }, 100);
    }
  }

  // Download list data as CSV
  downloadListCSV(listId) {
    const list = this.lists.find(l => l.id === listId);
    const observations = this.observations.filter(obs => obs.listId === listId)
                                         .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    if (!list || observations.length === 0) {
      this.showToast('No data to export', 'error');
      return;
    }

    // Prepare CSV headers
    const headers = [
      'Date',
      'Time', 
      'Common Name',
      'Scientific Name',
      'Family',
      'Count',
      'Comments',
      'Location Name',
      'City',
      'State',
      'Latitude',
      'Longitude',
      'Elevation (m)',
      'List Name'
    ];

    // Prepare CSV data
    const csvData = observations.map(obs => {
      const butterfly = getButterflyById(obs.butterflyId);
      const obsDate = new Date(obs.dateTime);
      const indianDateTime = this.formatIndianDateTime(obsDate);
      
      // Get location data from observation or fall back to list location
      const location = obs.location || list.location;
      
      return [
        indianDateTime.date,
        indianDateTime.time,
        butterfly ? butterfly.commonName : 'Unknown',
        butterfly ? butterfly.scientificName : 'Unknown',
        butterfly ? butterfly.commonFamilyName : 'Unknown',
        obs.count,
        obs.comments || '',
        location ? location.name : '',
        location ? location.city : '',
        location ? location.state : '',
        location ? location.latitude : '',
        location ? location.longitude : '',
        location ? location.elevation || '' : '',
        list.name
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => 
        // Escape fields that contain commas or quotes
        typeof field === 'string' && (field.includes(',') || field.includes('"')) 
          ? `"${field.replace(/"/g, '""')}"` 
          : field
      ).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `butterfly-list-${list.name}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showToast('CSV file downloaded successfully!', 'success');
    } else {
      this.showToast('CSV download not supported in this browser', 'error');
    }
  }
  
  // Update list selector in count view
  // Update count view list selector (only active lists)
  updateCountViewListSelector() {
    const countViewListSelect = document.getElementById('countViewListSelect');
    if (!countViewListSelect) return;

    // Preserve currently selected list
    const currentSelection = this.selectedCountViewList;

    const activeLists = this.lists.filter(list => list.status === 'active').sort((a, b) => b.createdAt - a.createdAt);
    
    countViewListSelect.innerHTML = '<option value="">Choose an active list to add observations</option>';
    activeLists.forEach(list => {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = `${list.name} (Active)`;
      countViewListSelect.appendChild(option);
    });

    // Auto-select logic
    if (currentSelection) {
      // Check if current selection is still active
      const currentList = this.lists.find(l => l.id == currentSelection);
      if (currentList && currentList.status === 'active') {
        countViewListSelect.value = currentSelection;
        this.selectedCountViewList = currentSelection;
      } else {
        // Clear selection if list is now closed
        this.selectedCountViewList = null;
      }
    } else if (activeLists.length === 1) {
      // Auto-select if only one active list
      countViewListSelect.value = activeLists[0].id;
      this.selectedCountViewList = activeLists[0].id;
      // Update UI with auto-selected list
      this.renderObservations();
    }

    // Add event listener for list selection changes
    countViewListSelect.removeEventListener('change', this.handleCountViewListChange);
    this.handleCountViewListChange = () => {
      this.selectedCountViewList = countViewListSelect.value ? parseInt(countViewListSelect.value) : null;
      this.renderObservations();
    };
    countViewListSelect.addEventListener('change', this.handleCountViewListChange);
  }

  // Butterfly name autocomplete
  handleButterflyNameAutocomplete(query) {
    const suggestionsContainer = document.getElementById('butterflyNameSuggestions');
    if (!suggestionsContainer) return;

    if (!query || query.length < 2) {
      suggestionsContainer.classList.add('hidden');
      return;
    }

    const results = searchButterflies(query).slice(0, 20);
    suggestionsContainer.classList.remove('hidden');
    
    suggestionsContainer.innerHTML = '';
    results.forEach(butterfly => {
      const suggestion = document.createElement('div');
      suggestion.className = 'suggestion-item';
      suggestion.innerHTML = `
        <span class="suggestion-name">${butterfly.commonName}</span>
        <span class="suggestion-scientific">${butterfly.scientificName}</span>
      `;

      suggestion.addEventListener('click', () => {
        document.getElementById('butterflyNameInput').value = butterfly.commonName;
        suggestionsContainer.classList.add('hidden');
        
        // Auto-populate time when butterfly is selected from suggestions
        const obsTimeInput = document.getElementById('obsTimeInput');
        if (obsTimeInput && !obsTimeInput.value) {
          const now = new Date();
          obsTimeInput.value = now.toTimeString().slice(0, 5);
        }
      });

      suggestionsContainer.appendChild(suggestion);
    });
  }

  // Add butterfly observation
  async addButterfly() {
    const butterflyName = document.getElementById('butterflyNameInput').value.trim();
    const count = parseInt(document.getElementById('countInput').value);
    const speciesType = document.getElementById('speciesTypeInput').value;
    const obsDate = document.getElementById('obsDateInput').value;
    const obsTime = document.getElementById('obsTimeInput').value;
    const comments = document.getElementById('commentsInput').value.trim();

    // Validate all fields are filled
    if (!butterflyName) {
      this.showToast('Please enter butterfly name', 'error');
      return;
    }

    if (!this.selectedCountViewList) {
      this.showToast('Please select a list first', 'error');
      return;
    }

    if (!count || isNaN(count) || count < 1) {
      this.showToast('Please enter a valid count (minimum 1)', 'error');
      return;
    }

    if (!speciesType) {
      this.showToast('Please select species type', 'error');
      return;
    }

    if (!obsDate) {
      this.showToast('Please select observation date', 'error');
      return;
    }

    if (!obsTime) {
      this.showToast('Please select observation time', 'error');
      return;
    }

    const butterfly = getButterflyByName(butterflyName);
    if (!butterfly) {
      this.showToast('Butterfly not found in database', 'error');
      return;
    }

    // Combine date and time
    const dateTimeString = `${obsDate}T${obsTime}`;
    const dateTime = new Date(dateTimeString);

    // Get location data from the selected list
    const selectedList = this.lists.find(list => list.id === this.selectedCountViewList);
    const locationData = selectedList && selectedList.location ? {
      locationId: selectedList.location.id,
      locationName: selectedList.location.name,
      city: selectedList.location.city,
      state: selectedList.location.state,
      latitude: selectedList.location.latitude,
      longitude: selectedList.location.longitude,
      elevation: selectedList.location.elevation,
      type: selectedList.location.type
    } : null;

    const observation = {
      butterflyId: butterfly.id,
      butterflyName: butterfly.commonName,
      listId: this.selectedCountViewList,
      count,
      speciesType: speciesType, // Add species type
      isRare: speciesType === 'rare', // Boolean flag for easier filtering
      dateTime: dateTime.getTime(),
      obsDate: obsDate,
      obsTime: obsTime,
      comments: comments, // Add comments field
      location: locationData, // Add location data to observation
      createdAt: Date.now()
    };

    try {
      await this.addToStore('observations', observation);
      
      // Reload observations data and update UI while preserving list selection
      this.observations = await this.getAllFromStore('observations');
      this.renderObservations();
      this.renderLists(); // Update Lists cards with new observation data
      
      // Clear form and reset to current time
      document.getElementById('butterflyNameInput').value = '';
      document.getElementById('countInput').value = '1';
      document.getElementById('speciesTypeInput').value = 'common'; // Reset to default
      document.getElementById('commentsInput').value = ''; // Clear comments field
      const now = new Date();
      document.getElementById('obsDateInput').value = now.toISOString().split('T')[0];
      document.getElementById('obsTimeInput').value = ''; // Clear time to force user selection
      
      // Remove focus to keep cursor outside the form
      if (document.activeElement) {
        document.activeElement.blur();
      }
      
      this.showToast('Butterfly added successfully!', 'success');
      vibrate([100, 200, 100]);
    } catch (error) {
      console.error('Error adding butterfly:', error);
      this.showToast('Error adding butterfly', 'error');
    }
  }

  // Fix observation butterfly ID when there's a mismatch
  async fixObservationButterflyId(speciesName, correctButterflyId) {
    try {
      const observationsToFix = this.observations.filter(obs => 
        obs.butterflyName === speciesName && !getButterflyById(obs.butterflyId)
      );
      
      if (observationsToFix.length > 0) {
        console.log(`Fixing ${observationsToFix.length} observations for species: ${speciesName}`);
        
        for (const obs of observationsToFix) {
          obs.butterflyId = correctButterflyId;
          await this.updateInStore('observations', obs);
        }
        
        // Reload observations
        this.observations = await this.getAllFromStore('observations');
        this.renderObservations();
        
        this.showToast(`Fixed butterfly ID for ${speciesName}`, 'success');
        console.log(`Successfully fixed butterfly IDs for ${speciesName}`);
      }
    } catch (error) {
      console.error('Error fixing observation butterfly ID:', error);
    }
  }

  // Render observations
  renderObservations() {
    const container = document.getElementById('observationsList');
    const titleElement = document.getElementById('observationsTitle');
    if (!container) return;

    let observations;
    let selectedList = null;
    
    if (this.selectedCountViewList) {
      // Show observations for the specific selected list only
      observations = this.observations.filter(obs => obs.listId === this.selectedCountViewList);
      selectedList = this.lists.find(list => list.id === this.selectedCountViewList);
    } else {
      // No list selected, show message to select a list
      container.innerHTML = '<p class="empty-state">Please select a list to view observations</p>';
      if (titleElement) {
        titleElement.textContent = 'Ongoing Observations';
      }
      return;
    }

    // Update title with list name
    if (titleElement && selectedList) {
      titleElement.textContent = `Ongoing Observations in ${selectedList.name}`;
    }

    if (observations.length === 0) {
      container.innerHTML = '<p class="empty-state">No observations in this list yet</p>';
      return;
    }

    // Group observations by species name
    const groupedObservations = new Map();
    observations.forEach(obs => {
      const species = obs.butterflyName;
      if (!groupedObservations.has(species)) {
        groupedObservations.set(species, []);
      }
      groupedObservations.get(species).push(obs);
    });

    // Convert to array and sort alphabetically by species name
    const groupedArray = Array.from(groupedObservations.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    container.innerHTML = '';
    groupedArray.forEach(([speciesName, speciesObservations]) => {
      const obsCard = this.createConsolidatedObservationCard(speciesName, speciesObservations);
      container.appendChild(obsCard);
    });
  }

  // Create consolidated observation card for multiple observations of same species
  createConsolidatedObservationCard(speciesName, observations) {
    const card = document.createElement('div');
    card.className = 'observation-card';
    
    // Calculate total count and number of observations
    const totalCount = observations.reduce((sum, obs) => sum + obs.count, 0);
    const numberOfObservations = observations.length;
    
    // Get the most recent observation for time reference
    const latestObs = observations.reduce((latest, current) => 
      current.dateTime > latest.dateTime ? current : latest
    );
    
    // Get butterfly details to show scientific name
    const butterfly = getButterflyById(latestObs.butterflyId);
    const scientificName = butterfly ? butterfly.scientificName : 'Unknown';
    
    // Collect all comments (abbreviated for compact view)
    const hasComments = observations.some(obs => obs.comments);
    
    const latestDateTime = new Date(latestObs.dateTime);
    
    card.innerHTML = `
      <div class="obs-content">
        <div class="obs-main-info">
          <div class="obs-names">
            <span class="obs-common-name clickable-species" data-butterfly-id="${latestObs.butterflyId}">${speciesName}</span>
            <span class="obs-scientific-name"><em>${scientificName}</em></span>
          </div>
          <div class="obs-stats-inline">
            <span class="stat-badge count">${totalCount}</span>
            <span class="stat-badge obs">${numberOfObservations}</span>
            ${hasComments ? '<span class="stat-badge comment clickable-comment" title="View comments">💬</span>' : ''}
          </div>
        </div>
        <div class="obs-time-compact">${this.formatIndianDateTime(latestDateTime).time}</div>
      </div>
      <div class="obs-actions-compact">
        <button class="action-btn-small primary" data-species="${speciesName}" title="Add more">➕</button>
        <button class="action-btn-small secondary" data-species="${speciesName}" title="Edit">✏️</button>
        <button class="action-btn-small danger" data-species="${speciesName}" title="Delete">🗑️</button>
      </div>
    `;

    // Add event listeners for action buttons
    const editBtn = card.querySelector('.action-btn-small.secondary');
    const addMoreBtn = card.querySelector('.action-btn-small.primary');
    const deleteBtn = card.querySelector('.action-btn-small.danger');
    const speciesNameLink = card.querySelector('.clickable-species');

    // Add click handler for species name to show detail modal
    if (speciesNameLink) {
      speciesNameLink.addEventListener('click', async (e) => {
        e.stopPropagation();
        const butterflyId = speciesNameLink.getAttribute('data-butterfly-id');
        if (butterflyId) {
          try {
            // Wait for butterfly data to load if it hasn't already
            await this.ensureButterflyDataLoaded();
            
            // Debug: Convert butterflyId to number and check data
            const numericId = parseInt(butterflyId);
            console.log('Looking for butterfly with ID:', numericId, 'from observations');
            console.log('Total butterflies in data:', BUTTERFLY_DATA.length);
            console.log('Butterfly IDs range:', 
              Math.min(...BUTTERFLY_DATA.map(b => b.id)), 
              'to', 
              Math.max(...BUTTERFLY_DATA.map(b => b.id))
            );
            
            const butterfly = getButterflyById(numericId);
            if (butterfly) {
              console.log('Found butterfly:', butterfly.commonName);
              this.showButterflyDetail(butterfly);
            } else {
              console.error('Butterfly not found with ID:', numericId);
              console.log('Available IDs sample:', BUTTERFLY_DATA.slice(0, 5).map(b => ({id: b.id, name: b.commonName})));
              
              // Try to find by name as fallback
              const butterflyByName = getButterflyByName(speciesName);
              if (butterflyByName) {
                console.log('Found by name instead:', butterflyByName.commonName, 'ID:', butterflyByName.id);
                this.showButterflyDetail(butterflyByName);
                // Update the observation with correct ID
                this.fixObservationButterflyId(speciesName, butterflyByName.id);
              } else {
                this.showToast('Species details not found', 'error');
              }
            }
          } catch (error) {
            console.error('Error loading species details:', error);
            this.showToast('Error loading species details', 'error');
          }
        }
      });
    }

    // Add click handler for comment icon to show all comments
    const commentIcon = card.querySelector('.clickable-comment');
    if (commentIcon) {
      commentIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showSpeciesComments(speciesName, observations);
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Edit the most recent observation
        this.editObservation(latestObs);
      });
    }

    if (addMoreBtn) {
      addMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Use the latest observation as reference for adding more
        this.addMoreObservation(latestObs);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Delete the most recent observation
        this.deleteObservation(latestObs.id);
      });
    }

    return card;
  }

  // Create observation card
  createObservationCard(observation) {
    const card = document.createElement('div');
    card.className = 'observation-card';
    
    // Get butterfly details to show scientific name
    const butterfly = getButterflyById(observation.butterflyId);
    const scientificName = butterfly ? butterfly.scientificName : 'Unknown';
    
    const dateTime = new Date(observation.dateTime);
    
    card.innerHTML = `
      <div class="obs-content">
        <div class="obs-main-info">
          <div class="obs-names">
            <span class="obs-common-name">${observation.butterflyName}</span>
            <span class="obs-scientific-name"><em>${scientificName}</em></span>
          </div>
          <div class="obs-stats-inline">
            <span class="stat-badge count">${observation.count}</span>
            <span class="stat-badge obs">1</span>
            ${observation.comments ? '<span class="stat-badge comment clickable-comment" title="View comments">💬</span>' : ''}
          </div>
        </div>
        <div class="obs-time-compact">${this.formatIndianDateTime(dateTime).time}</div>
      </div>
      <div class="obs-actions-compact">
        <button class="action-btn-small primary" data-obs-id="${observation.id}" title="Add more">➕</button>
        <button class="action-btn-small secondary" data-obs-id="${observation.id}" title="Edit">✏️</button>
        <button class="action-btn-small danger" data-obs-id="${observation.id}" title="Delete">🗑️</button>
      </div>
    `;

    // Add event listeners for action buttons
    const editBtn = card.querySelector('.action-btn-small.secondary');
    const addMoreBtn = card.querySelector('.action-btn-small.primary');
    const deleteBtn = card.querySelector('.action-btn-small.danger');
    const commentIcon = card.querySelector('.clickable-comment');

    // Add click handler for comment icon to show individual comment
    if (commentIcon) {
      commentIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showIndividualComment(observation);
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editObservation(observation);
      });
    }

    if (addMoreBtn) {
      addMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addMoreObservation(observation);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteObservation(observation.id);
      });
    }

    return card;
  }

  // Delete observation
  async deleteObservation(obsId) {
    if (!confirm('Are you sure you want to delete this observation?')) {
      return;
    }

    try {
      await this.deleteFromStore('observations', obsId);
      
      // Reload observations data and update UI while preserving list selection
      this.observations = await this.getAllFromStore('observations');
      this.renderObservations();
      this.renderLists(); // Update Lists cards after deletion
      
      this.showToast('Observation deleted', 'success');
    } catch (error) {
      console.error('Error deleting observation:', error);
      this.showToast('Error deleting observation', 'error');
    }
  }

  // Modal management with proper stacking
  showModal(modalId) {
    console.log('showModal called with modalId:', modalId);
    const modal = document.getElementById(modalId);
    console.log('Found modal element:', modal);
    if (modal) {
      // Force remove all possible hiding classes and attributes
      modal.classList.remove('hidden');
      modal.removeAttribute('hidden');
      
      // For addCustomLocationModal, use absolute force
      if (modalId === 'addCustomLocationModal') {
        console.log('Applying FORCE SHOW for addCustomLocationModal');
        modal.className = 'modal'; // Remove ALL classes except modal
        modal.style.cssText = `
          display: flex !important;
          position: fixed !important;
          z-index: 10001 !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background-color: rgba(0, 0, 0, 0.5) !important;
          visibility: visible !important;
          opacity: 1 !important;
        `;
      } else {
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('position', 'fixed', 'important');
        modal.style.setProperty('z-index', '9999', 'important');
        modal.style.setProperty('top', '0', 'important');
        modal.style.setProperty('left', '0', 'important');
        modal.style.setProperty('right', '0', 'important');
        modal.style.setProperty('bottom', '0', 'important');
        modal.style.setProperty('background-color', 'rgba(0, 0, 0, 0.5)', 'important');
        modal.style.setProperty('visibility', 'visible', 'important');
        modal.style.setProperty('opacity', '1', 'important');
      }
      
      // Also ensure the modal content is visible with aggressive styling
      const modalContent = modal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.style.setProperty('display', 'block', 'important');
        modalContent.style.setProperty('visibility', 'visible', 'important');
        modalContent.style.setProperty('opacity', '1', 'important');
        modalContent.style.setProperty('position', 'relative', 'important');
        modalContent.style.setProperty('z-index', 'inherit', 'important');
        
        // Use fallback colors for the custom location modal to ensure visibility
        if (modalId === 'addCustomLocationModal') {
          modalContent.style.setProperty('background-color', '#ffffff', 'important');
          modalContent.style.setProperty('color', '#333333', 'important');
          modalContent.style.setProperty('border', '2px solid #007bff', 'important');
          modalContent.style.setProperty('box-shadow', '0 4px 20px rgba(0, 0, 0, 0.3)', 'important');
          modalContent.style.setProperty('max-width', '600px', 'important');
          modalContent.style.setProperty('width', '95%', 'important');
          modalContent.style.setProperty('margin', 'auto', 'important');
        } else {
          modalContent.style.setProperty('background-color', 'var(--surface-color)', 'important');
          modalContent.style.setProperty('color', 'var(--text-primary)', 'important');
        }
        
        console.log('Modal content styled:', modalContent);
      }
      
      document.body.style.overflow = 'hidden';
      console.log('Modal shown successfully:', modalId);
      console.log('Modal classes after show:', modal.className);
      console.log('Modal display style:', modal.style.display);
      console.log('Modal z-index:', modal.style.zIndex);
      
      // Special handling for create list modal
      if (modalId === 'createListModal') {
        this.populateCreateListForm();
      }
    } else {
      console.error('Modal not found:', modalId);
    }
  }

  populateCreateListForm() {
    const listDateInput = document.getElementById('listDateInput');
    const listStartTimeInput = document.getElementById('listStartTimeInput');
    
    // Reset custom location fields to hidden state
    this.hideCustomLocationFields();
    
    if (listDateInput && listStartTimeInput) {
      // Get current date and time in IST
      const now = new Date();
      
      // Convert to IST for consistent timezone handling
      const istDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      
      // Set current date in ISO format (YYYY-MM-DD) for date input
      const year = istDate.getFullYear();
      const month = String(istDate.getMonth() + 1).padStart(2, '0');
      const day = String(istDate.getDate()).padStart(2, '0');
      listDateInput.value = `${year}-${month}-${day}`;
      
      // Set current time in 24-hour format (HH:MM) for time input
      const hours = String(istDate.getHours()).padStart(2, '0');
      const minutes = String(istDate.getMinutes()).padStart(2, '0');
      listStartTimeInput.value = `${hours}:${minutes}`;
      
      // When user focuses on time input, show current time as placeholder
      listStartTimeInput.addEventListener('focus', function() {
        if (!this.value) {
          const currentNow = new Date();
          const currentTime = currentNow.toTimeString().slice(0, 5);
          this.placeholder = `Current time: ${currentTime}`;
        }
      });
      
      // Clear placeholder when user starts typing
      listStartTimeInput.addEventListener('input', function() {
        this.placeholder = '';
      });
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
      document.body.style.overflow = '';
      
      // Reset custom location fields when closing create list modal
      if (modalId === 'createListModal') {
        this.hideCustomLocationFields();
      }
      
      console.log('Modal hidden:', modalId);
    }
  }

  // Update total species count on dashboard
  updateTotalSpeciesCount() {
    // Only update these counts on the butterflies view dashboard, not on count view
    if (this.currentView === 'butterflies') {
      // Update the total species count to show available species (317)
      this.updateElement('totalSpeciesCount', BUTTERFLY_DATA.length);
      
      // Update unique species count on dashboard with actual database size  
      this.updateElement('uniqueSpeciesCount', BUTTERFLY_DATA.length);
    }
  }

  // Utility functions
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.reset();
    }
  }

  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.classList.add('hidden');
      }, 1000);
    }
  }

  async refreshData() {
    await this.loadData();
    this.showToast('Data refreshed!', 'success');
  }

  setupAutoComplete() {
    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
      const suggestions = document.getElementById('butterflyNameSuggestions');
      const searchResults = document.getElementById('searchResults');
      
      if (suggestions && !e.target.closest('#butterflyNameInput') && !e.target.closest('#butterflyNameSuggestions')) {
        suggestions.classList.add('hidden');
      }
      
      if (searchResults && !e.target.closest('#butterflySearch') && !e.target.closest('#searchResults')) {
        searchResults.classList.add('hidden');
      }
    });
  }

  // Edit observation functionality
  editObservation(observation) {
    document.getElementById('editSpeciesName').value = observation.butterflyName;
    document.getElementById('editCountInput').value = observation.count;
    document.getElementById('editCommentInput').value = observation.comments || '';

    // Store current observation for editing
    this.currentEditingObservation = observation;

    this.showModal('editObservationModal');

    // Set up form submission
    const form = document.getElementById('editObservationForm');
    const submitHandler = async (e) => {
      e.preventDefault();
      await this.updateObservation();
      form.removeEventListener('submit', submitHandler);
    };
    form.addEventListener('submit', submitHandler);
  }

  // Update observation
  async updateObservation() {
    const count = parseInt(document.getElementById('editCountInput').value);
    const comments = document.getElementById('editCommentInput').value.trim();

    if (!count || count < 1) {
      this.showToast('Please enter a valid count', 'error');
      return;
    }

    try {
      // Update the observation
      this.currentEditingObservation.count = count;
      this.currentEditingObservation.comments = comments;

      // Save to database
      const transaction = this.db.transaction(['observations'], 'readwrite');
      const store = transaction.objectStore('observations');
      await store.put(this.currentEditingObservation);

      this.hideModal('editObservationModal');
      this.showToast('Observation updated successfully!', 'success');
      
      // Refresh display
      this.renderObservations();
      this.renderLists(); // Update Lists cards with edited observation data
    } catch (error) {
      console.error('Error updating observation:', error);
      this.showToast('Error updating observation', 'error');
    }
  }

  // Add more observation of the same species
  addMoreObservation(observation) {
    document.getElementById('addMoreSpeciesName').value = observation.butterflyName;
    document.getElementById('addMoreCountInput').value = 1;
    document.getElementById('addMoreCommentInput').value = '';
    
    // Set current time
    const now = new Date();
    document.getElementById('addMoreTimeInput').value = now.toTimeString().slice(0, 5);

    // Store reference for adding more
    this.currentAddMoreObservation = observation;

    this.showModal('addMoreObservationModal');

    // Set up form submission
    const form = document.getElementById('addMoreObservationForm');
    const submitHandler = async (e) => {
      e.preventDefault();
      await this.saveMoreObservation();
      form.removeEventListener('submit', submitHandler);
    };
    form.addEventListener('submit', submitHandler);
  }

  // Save additional observation
  async saveMoreObservation() {
    const count = parseInt(document.getElementById('addMoreCountInput').value);
    const time = document.getElementById('addMoreTimeInput').value;
    const comments = document.getElementById('addMoreCommentInput').value.trim();

    if (!count || count < 1) {
      this.showToast('Please enter a valid count', 'error');
      return;
    }

    if (!time) {
      this.showToast('Please select a time', 'error');
      return;
    }

    try {
      // Get current date from the selected list or today
      const selectedList = this.lists.find(list => list.id === this.selectedCountViewList);
      const listDate = selectedList ? selectedList.date : new Date().toISOString().split('T')[0];
      
      // Combine date and time
      const dateTimeString = `${listDate}T${time}`;
      const dateTime = new Date(dateTimeString);

      // Create new observation
      const newObservation = {
        id: Date.now(), // Simple ID generation
        butterflyId: this.currentAddMoreObservation.butterflyId,
        butterflyName: this.currentAddMoreObservation.butterflyName,
        listId: this.selectedCountViewList,
        count,
        speciesType: this.currentAddMoreObservation.speciesType,
        isRare: this.currentAddMoreObservation.isRare,
        dateTime: dateTime.getTime(),
        obsDate: listDate,
        obsTime: time,
        comments: comments || null,
        location: this.currentAddMoreObservation.location || (selectedList && selectedList.location ? {
          locationId: selectedList.location.id,
          locationName: selectedList.location.name,
          city: selectedList.location.city,
          state: selectedList.location.state,
          latitude: selectedList.location.latitude,
          longitude: selectedList.location.longitude,
          elevation: selectedList.location.elevation,
          type: selectedList.location.type
        } : null), // Copy location data from original observation or list
        createdAt: Date.now()
      };

      // Save to database
      const transaction = this.db.transaction(['observations'], 'readwrite');
      const store = transaction.objectStore('observations');
      await store.add(newObservation);

      // Add to memory
      this.observations.push(newObservation);

      this.hideModal('addMoreObservationModal');
      this.showToast('Additional observation added successfully!', 'success');
      
      // Refresh display
      this.renderObservations();
      this.renderLists(); // Update Lists cards with new observation data
    } catch (error) {
      console.error('Error adding more observation:', error);
      this.showToast('Error adding observation', 'error');
    }
  }

  // Capture chart images as base64 for embedding in HTML reports
  async captureChartImages(listId) {
    const chartImages = {};
    
    try {
      console.log('📸 Attempting to capture chart images for list:', listId);
      
      // Wait longer for chart renders to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get all canvases in the stats modal for debugging
      const allCanvases = document.querySelectorAll('#statsModal canvas');
      console.log(`Found ${allCanvases.length} canvas elements in stats modal`);
      
      // Debug: Log all canvas IDs and chart instances
      allCanvases.forEach((canvas, index) => {
        console.log(`Canvas ${index}: id="${canvas.id}", hasChartInstance=${!!canvas.chartInstance}`);
      });
      
      // Try to find pie chart canvas with improved selectors
      let pieCanvas = null;
      
      // Method 1: Try by ID pattern (most specific)
      pieCanvas = document.querySelector(`canvas[id*="pieChart_${listId}"]`);
      console.log('Method 1 - pie chart by list ID:', !!pieCanvas);
      
      if (!pieCanvas) {
        // Method 2: Try general pie chart pattern
        pieCanvas = document.querySelector(`canvas[id*="pieChart"]`);
        console.log('Method 2 - pie chart by general pattern:', !!pieCanvas);
      }
      
      if (!pieCanvas) {
        // Method 3: Try first canvas in chart container
        pieCanvas = document.querySelector('.chart-container canvas');
        console.log('Method 3 - first canvas in chart container:', !!pieCanvas);
      }
      
      if (!pieCanvas) {
        // Method 4: Try first canvas in stats modal
        const firstCanvas = document.querySelector('#statsModal canvas');
        if (firstCanvas && firstCanvas.id.includes('pieChart')) {
          pieCanvas = firstCanvas;
        }
        console.log('Method 4 - first canvas in stats modal (if pie):', !!pieCanvas);
      }
      
      if (pieCanvas) {
        console.log(`Found pie chart canvas: id="${pieCanvas.id}", chartInstance=${!!pieCanvas.chartInstance}`);
        
        if (pieCanvas.chartInstance) {
          try {
            // Wait a bit more to ensure chart is fully rendered
            await new Promise(resolve => setTimeout(resolve, 200));
            chartImages.pieChart = pieCanvas.toDataURL('image/png', 1.0);
            console.log('✅ Pie chart captured successfully');
          } catch (error) {
            console.warn('Failed to capture pie chart:', error);
          }
        } else {
          console.log('⚠️ Pie chart canvas found but no chart instance attached');
          
          // Try to capture anyway in case chart instance is stored differently
          try {
            chartImages.pieChart = pieCanvas.toDataURL('image/png', 1.0);
            console.log('✅ Pie chart captured without chart instance reference');
          } catch (error) {
            console.warn('Failed to capture pie chart without chart instance:', error);
          }
        }
      } else {
        console.log('⚠️ Pie chart canvas not found with any method');
      }
      
      // Try to find interval chart canvas with improved selectors
      let intervalCanvas = null;
      
      // Method 1: Try by ID pattern (most specific)
      intervalCanvas = document.querySelector(`canvas[id*="intervalChart_${listId}"]`);
      console.log('Method 1 - interval chart by list ID:', !!intervalCanvas);
      
      if (!intervalCanvas) {
        // Method 2: Try general interval chart pattern
        intervalCanvas = document.querySelector(`canvas[id*="intervalChart"]`);
        console.log('Method 2 - interval chart by general pattern:', !!intervalCanvas);
      }
      
      if (!intervalCanvas) {
        // Method 3: Try canvas in interval chart container
        intervalCanvas = document.querySelector('.interval-chart-container canvas');
        console.log('Method 3 - canvas in interval chart container:', !!intervalCanvas);
      }
      
      if (!intervalCanvas) {
        // Method 4: Try second canvas in stats modal (if there are multiple)
        if (allCanvases.length > 1) {
          intervalCanvas = allCanvases[1];
        }
        console.log('Method 4 - second canvas in stats modal:', !!intervalCanvas);
      }
      
      if (intervalCanvas) {
        console.log(`Found interval chart canvas: id="${intervalCanvas.id}", chartInstance=${!!intervalCanvas.chartInstance}`);
        
        if (intervalCanvas.chartInstance || intervalCanvas.getContext('2d')) {
          try {
            // Wait a bit more to ensure chart is fully rendered
            await new Promise(resolve => setTimeout(resolve, 200));
            chartImages.intervalChart = intervalCanvas.toDataURL('image/png', 1.0);
            console.log('✅ Interval chart captured successfully');
          } catch (error) {
            console.warn('Failed to capture interval chart:', error);
          }
        } else {
          console.log('⚠️ Interval chart canvas found but no chart instance or context');
        }
      } else {
        console.log('⚠️ Interval chart canvas not found');
      }
      
    } catch (error) {
      console.error('Error capturing chart images:', error);
    }
    
    console.log('Chart capture complete. Images captured:', Object.keys(chartImages));
    console.log('Pie chart size:', chartImages.pieChart ? `${chartImages.pieChart.length} chars` : 'not captured');
    console.log('Interval chart size:', chartImages.intervalChart ? `${chartImages.intervalChart.length} chars` : 'not captured');
    
    return chartImages;
  }

  // Generate HTML report for download
  async generateHTMLReport(providedList = null) {
    try {
      let list, observations, listName;
      
      if (providedList) {
        // Use the provided list data directly
        list = providedList;
        listName = list.name;
        observations = this.observations.filter(obs => obs.listId === list.id)
                                       .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      } else {
        // Get the current list being displayed in the stats modal
        const titleElement = document.getElementById('statsModalTitle');
        listName = titleElement ? titleElement.textContent.replace('Statistics - ', '') : 'Butterfly Observation List';
        
        // Get current list data
        const currentListId = this.currentDisplayedListId;
        console.log('generateHTMLReport - currentListId:', currentListId);
        console.log('Available lists:', this.lists.map(l => ({ id: l.id, name: l.name })));
        
        if (!currentListId) {
          this.showToast('No list data available for HTML generation', 'error');
          return;
        }
        
        list = this.lists.find(l => l.id === currentListId);
        observations = this.observations.filter(obs => obs.listId === currentListId)
                                       .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      }
      
      console.log('Found list:', list);
      console.log('Found observations:', observations.length);
      
      if (!list || observations.length === 0) {
        this.showToast('No data available for HTML generation', 'error');
        console.log('Error: list =', list, 'observations.length =', observations.length);
        return;
      }

      // Show loading message
      this.showToast('Generating report with embedded charts...', 'info', 2000);
      
      // Capture current chart images before generating HTML
      console.log('📸 Capturing chart images...');
      const chartImages = await this.captureChartImages(list.id);
      console.log('Chart images captured:', Object.keys(chartImages));
      console.log('Pie chart available for HTML:', !!chartImages.pieChart);
      console.log('Interval chart available for HTML:', !!chartImages.intervalChart);
      
      // Calculate comprehensive statistics (same as showListStats)
      const speciesCount = new Map();
      const familyCount = new Map();
      const timeOfDayCount = new Map();
      const rareSpeciesSet = new Set();
      
      observations.forEach(obs => {
        const butterfly = getButterflyById(obs.butterflyId);
        const name = butterfly ? butterfly.commonName : 'Unknown';
        const family = butterfly ? butterfly.family : 'Unknown';
        
        speciesCount.set(name, (speciesCount.get(name) || 0) + obs.count);
        familyCount.set(family, (familyCount.get(family) || 0) + obs.count);
        
        // Track unique rare species
        if (obs.isRare === true || obs.speciesType === 'rare') {
          rareSpeciesSet.add(name);
        }
        
        // Track time of day patterns using 30-minute intervals
        if (obs.obsTime) {
          try {
            const [hour, minute] = obs.obsTime.split(':').map(Number);
            
            if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
              const totalMinutes = hour * 60 + minute;
              const intervalStart = Math.floor(totalMinutes / 30) * 30;
              const startHour = Math.floor(intervalStart / 60);
              const startMinute = intervalStart % 60;
              const endMinutes = intervalStart + 30;
              const endHour = Math.floor(endMinutes / 60);
              const endMinute = endMinutes % 60;
              
              const formatTime = (h, m) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
              const timeSlot = `${formatTime(startHour, startMinute)}-${formatTime(endHour, endMinute)}`;
              
              timeOfDayCount.set(timeSlot, (timeOfDayCount.get(timeSlot) || 0) + obs.count);
            }
          } catch (error) {
            console.warn('Invalid time format for observation:', obs.obsTime);
          }
        }
      });

      const sortedSpecies = Array.from(speciesCount.entries()).sort((a, b) => b[1] - a[1]);
      const sortedFamilies = Array.from(familyCount.entries()).sort((a, b) => b[1] - a[1]);
      const sortedTimeSlots = Array.from(timeOfDayCount.entries()).sort((a, b) => b[1] - a[1]);

      const uniqueSpecies = speciesCount.size;
      const totalCount = Array.from(speciesCount.values()).reduce((sum, count) => sum + count, 0);
      const uniqueFamilies = familyCount.size;
      const rareSpeciesCount = rareSpeciesSet.size;
      const highestCount = sortedSpecies.length > 0 ? sortedSpecies[0] : null;
      
      // Calculate observation time span and interval data
      let timeSpan = 'N/A';
      let firstObsTime = null;
      let lastObsTime = null;
      let intervalData = [];
      
      if (observations.length > 0) {
        const times = observations.map(obs => new Date(obs.dateTime)).sort((a, b) => a - b);
        firstObsTime = times[0];
        lastObsTime = times[times.length - 1];
        
        if (observations.length > 1) {
          const duration = lastObsTime - firstObsTime;
          const hours = Math.floor(duration / (1000 * 60 * 60));
          const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
          timeSpan = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
        
        // Generate 30-minute interval data for closed lists
        if (list.status === 'closed') {
          intervalData = this.generate30MinuteIntervalData(observations, firstObsTime, lastObsTime);
        }
      }
      
      // Generate HTML content
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Butterfly Count Report - ${listName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
        }
        .header {
            border-bottom: 3px solid #E67E22;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        h1 {
            color: #E67E22;
            margin: 0;
            font-size: 2.5em;
        }
        h2 {
            color: #D35400;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 10px;
        }
        .subtitle {
            color: #666;
            font-size: 1.2em;
            margin: 10px 0;
        }
        .meta-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: #fff;
            border: 2px solid #E67E22;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #E67E22;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #E67E22;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background: #f9f9f9;
        }
        .comments-cell {
            max-width: 200px;
            word-wrap: break-word;
            font-style: italic;
            color: #666;
        }
        .no-comments {
            color: #999;
            font-size: 0.9em;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
        @media (max-width: 600px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
            table {
                font-size: 0.8em;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🦋 Butterfly Count Report</h1>
        <div class="subtitle">${listName}</div>
        <div class="meta-info">
            <strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Kolkata'
            })} IST
        </div>
    </div>

    <section>
        <h2>List Information</h2>
        <div class="meta-info">
            <p><strong>List Name:</strong> ${list.name}</p>
            <p><strong>Date Created:</strong> ${new Date(list.createdAt).toLocaleDateString('en-IN')}</p>
            <p><strong>Status:</strong> ${list.status.charAt(0).toUpperCase() + list.status.slice(1)}</p>
            ${list.location ? `<p><strong>Location:</strong> ${list.location.name}, ${list.location.city}, ${list.location.state}</p>` : ''}
        </div>
    </section>

    <section>
        <h2>Summary Statistics</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${uniqueSpecies}</div>
                <div class="stat-label">Unique Species</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalCount}</div>
                <div class="stat-label">Total Count</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${observations.length}</div>
                <div class="stat-label">Observations</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueFamilies}</div>
                <div class="stat-label">Families</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${rareSpeciesCount}</div>
                <div class="stat-label">Rare Species</div>
            </div>
            ${list.status === 'closed' ? `
            <div class="stat-card">
                <div class="stat-number">${timeSpan}</div>
                <div class="stat-label">Total Duration</div>
            </div>
            ` : `
            <div class="stat-card">
                <div class="stat-number">Active</div>
                <div class="stat-label">Status</div>
            </div>
            `}
        </div>
    </section>

    ${chartImages.pieChart ? `
    <section>
        <h2>🥧 Top 10 Species Distribution</h2>
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #ddd;">
            <div style="font-size: 1.2em; font-weight: bold; color: #E67E22; margin-bottom: 15px;">Species Count Distribution</div>
            <img src="${chartImages.pieChart}" alt="Top 10 Species Pie Chart" style="max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        </div>
    </section>
    ` : `
    <section>
        <h2>🥧 Top 10 Species Distribution</h2>
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #ddd;">
            <div style="font-size: 1.2em; font-weight: bold; color: #E67E22; margin-bottom: 15px;">Species Count Distribution</div>
            <div style="background: #fff; padding: 20px; border-radius: 4px; border: 2px dashed #ddd;">
                <p style="color: #666; margin: 0; font-style: italic;">📊 Pie chart could not be captured. Please ensure charts are fully loaded before generating the report.</p>
                <div style="margin-top: 15px;">
                    <h4>Top 10 Species (Data View)</h4>
                    <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #E67E22; color: white;">
                                <th style="padding: 8px; text-align: left;">Rank</th>
                                <th style="padding: 8px; text-align: left;">Species</th>
                                <th style="padding: 8px; text-align: center;">Count</th>
                                <th style="padding: 8px; text-align: center;">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedSpecies.slice(0, 10).map(([name, count], index) => {
                                const percentage = ((count / totalCount) * 100).toFixed(1);
                                return `
                                    <tr style="border-bottom: 1px solid #ddd;">
                                        <td style="padding: 8px; font-weight: bold;">#${index + 1}</td>
                                        <td style="padding: 8px;">${name}</td>
                                        <td style="padding: 8px; text-align: center; font-weight: bold;">${count}</td>
                                        <td style="padding: 8px; text-align: center;">${percentage}%</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </section>
    `}

    ${list.status === 'closed' && intervalData.length > 0 && chartImages.intervalChart ? `
    <section>
        <h2>📊 Activity Pattern Analysis</h2>
        <p style="color: #666; font-style: italic; margin-bottom: 20px;">
            Chart shows only 30-minute periods where observations were recorded, optimized for better readability.
        </p>
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #ddd;">
            <div style="font-size: 1.2em; font-weight: bold; color: #E67E22; margin-bottom: 15px;">Observation Activity Over Time</div>
            <img src="${chartImages.intervalChart}" alt="30-Minute Interval Activity Chart" style="max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        </div>
        
        <h3>Time Interval Breakdown</h3>
        <table>
            <thead>
                <tr>
                    <th>Time Range</th>
                    <th>Unique Species</th>
                    <th>Total Count</th>
                    <th>Most Common Species</th>
                </tr>
            </thead>
            <tbody>
                ${intervalData.map(interval => `
                    <tr>
                        <td>${interval.timeRange}</td>
                        <td style="text-align: center; font-weight: bold; color: ${interval.uniqueSpecies > 0 ? '#4CAF50' : '#999'};">${interval.uniqueSpecies}</td>
                        <td style="text-align: center; font-weight: bold; color: ${interval.totalCount > 0 ? '#E67E22' : '#999'};">${interval.totalCount}</td>
                        <td>${interval.mostCommon || 'None'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </section>
    ` : ''}

    ${highestCount ? `
    <section>
        <h2>🏆 Key Insights</h2>
        <div class="meta-info">
            <p><strong>Most Observed Species:</strong> ${highestCount[0]} (${highestCount[1]} butterflies)</p>
            ${sortedTimeSlots.length > 0 ? `
                <p><strong>Peak Activity Time:</strong> ${sortedTimeSlots[0][0]} (${sortedTimeSlots[0][1]} observation${sortedTimeSlots[0][1] !== 1 ? 's' : ''})</p>
            ` : ''}
            ${sortedFamilies.length > 0 ? `
                <p><strong>Most Common Family:</strong> ${sortedFamilies[0][0]} (${sortedFamilies[0][1]} butterflies)</p>
            ` : ''}
            ${list.status === 'closed' && firstObsTime && lastObsTime ? `
                <p><strong>First Observation:</strong> ${this.formatIndianDateTime(firstObsTime).time}</p>
                <p><strong>Last Observation:</strong> ${this.formatIndianDateTime(lastObsTime).time}</p>
            ` : ''}
        </div>
    </section>
    ` : ''}

    <section>
        <h2>📊 Complete Species Breakdown</h2>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Species</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${sortedSpecies.map(([name, count], index) => {
                    const percentage = ((count / totalCount) * 100).toFixed(1);
                    return `
                        <tr>
                            <td style="text-align: center; font-weight: bold;">#${index + 1}</td>
                            <td>${name}</td>
                            <td style="text-align: center; font-weight: bold;">${count}</td>
                            <td style="text-align: center;">${percentage}%</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </section>

    ${sortedFamilies.length > 1 ? `
    <section>
        <h2>🏠 Family Distribution</h2>
        <table>
            <thead>
                <tr>
                    <th>Family</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${sortedFamilies.map(([family, count]) => {
                    const percentage = ((count / totalCount) * 100).toFixed(1);
                    return `
                        <tr>
                            <td>${family}</td>
                            <td style="text-align: center; font-weight: bold;">${count}</td>
                            <td style="text-align: center;">${percentage}%</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </section>
    ` : ''}

    <section>
        <h2>Detailed Observations</h2>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Species</th>
                    <th>Scientific Name</th>
                    <th>Count</th>
                    <th>Comments</th>
                </tr>
            </thead>
            <tbody>
                ${observations.map(obs => {
                  const butterfly = getButterflyById(obs.butterflyId);
                  const obsTime = new Date(obs.dateTime);
                  const timeStr = this.formatIndianDateTime(obsTime).time;
                  const scientificName = butterfly ? butterfly.scientificName : 'Unknown';
                  const comments = obs.comments || '';
                  
                  return `
                    <tr>
                        <td>${timeStr}</td>
                        <td>${butterfly ? butterfly.commonName : obs.butterflyName}</td>
                        <td><em>${scientificName}</em></td>
                        <td style="text-align: center;">${obs.count}</td>
                        <td class="comments-cell">${comments || '<span class="no-comments">No comments</span>'}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>
    </section>

    <div class="footer">
        <p>Generated by Butterfly Count (India) PWA v5.1.0</p>
        <p>Report contains ${observations.length} observations of ${uniqueSpecies} species</p>
        <p>📊 Charts embedded as high-quality images for offline viewing</p>
    </div>
</body>
</html>`;

      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `butterfly-report-${list.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.html`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      this.showToast('HTML report downloaded successfully!', 'success');
      
    } catch (error) {
      console.error('Error generating HTML report:', error);
      this.showToast('Error generating HTML report', 'error');
    }
  }

  // Show all comments for a species
  showSpeciesComments(speciesName, observations) {
    const modal = document.getElementById('speciesCommentsModal');
    const titleElement = document.getElementById('commentsModalTitle');
    const contentElement = document.getElementById('commentsModalContent');

    if (titleElement) {
      titleElement.textContent = `Comments for ${speciesName}`;
    }

    if (contentElement) {
      const observationsWithComments = observations.filter(obs => obs.comments && obs.comments.trim());
      
      if (observationsWithComments.length === 0) {
        contentElement.innerHTML = '<div class="no-comments">No comments available for this species.</div>';
      } else {
        contentElement.innerHTML = observationsWithComments.map(obs => {
          const dateTime = new Date(obs.dateTime);
          const formattedDateTime = this.formatIndianDateTime(dateTime);
          
          return `
            <div class="comment-item">
              <div class="comment-header">
                <span class="comment-time">${formattedDateTime.date} at ${formattedDateTime.time}</span>
                <span class="comment-count">Count: ${obs.count}</span>
              </div>
              <div class="comment-text">${obs.comments}</div>
            </div>
          `;
        }).join('');
      }
    }

    this.showModal('speciesCommentsModal');
  }

  // Show individual observation comment
  showIndividualComment(observation) {
    const modal = document.getElementById('speciesCommentsModal');
    const titleElement = document.getElementById('commentsModalTitle');
    const contentElement = document.getElementById('commentsModalContent');

    if (titleElement) {
      titleElement.textContent = `Comment for ${observation.butterflyName}`;
    }

    if (contentElement) {
      if (!observation.comments || !observation.comments.trim()) {
        contentElement.innerHTML = '<div class="no-comments">No comments for this observation.</div>';
      } else {
        const dateTime = new Date(observation.dateTime);
        const formattedDateTime = this.formatIndianDateTime(dateTime);
        
        contentElement.innerHTML = `
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-time">${formattedDateTime.date} at ${formattedDateTime.time}</span>
              <span class="comment-count">Count: ${observation.count}</span>
            </div>
            <div class="comment-text">${observation.comments}</div>
          </div>
        `;
      }
    }

    this.showModal('speciesCommentsModal');
  }
}

// Utility Functions
function vibrate(pattern) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ButterflyCountApp();
});

// Global functions for external access
window.switchView = (view) => {
  if (window.app) {
    window.app.switchView(view);
  }
};

window.showModal = (modalId) => {
  if (window.app) {
    window.app.showModal(modalId);
  }
};

window.showToast = (message, type) => {
  if (window.app) {
    window.app.showToast(message, type);
  }
};

// Debug function to test the Add Custom Location button
window.testCustomLocationButton = () => {
  console.log('Testing Add Custom Location button...');
  const btn = document.getElementById('addCustomLocationBtn');
  console.log('Button found:', btn);
  if (btn) {
    console.log('Button is visible:', !btn.offsetParent === null);
    console.log('Button event listeners:', btn.onclick);
    btn.click();
  }
  return btn;
};

// Debug function to test the modal
window.testCustomLocationModal = () => {
  console.log('Testing Add Custom Location modal...');
  const modal = document.getElementById('addCustomLocationModal');
  console.log('Modal found:', modal);
  if (modal) {
    console.log('Modal classes:', modal.className);
    console.log('Modal style display:', modal.style.display);
    console.log('Modal computed style:', window.getComputedStyle(modal));
    window.showModal('addCustomLocationModal');
  }
  return modal;
};

// Debug function to inspect modal structure
window.inspectCustomLocationModal = () => {
  const modal = document.getElementById('addCustomLocationModal');
  if (modal) {
    console.log('Modal HTML:', modal.outerHTML);
    console.log('Modal children:', modal.children);
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      console.log('Modal content:', modalContent);
      console.log('Modal content style:', window.getComputedStyle(modalContent));
    }
  }
  return modal;
};
