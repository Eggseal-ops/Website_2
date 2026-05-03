document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const gameGrid = document.getElementById('gameGrid');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const noResults = document.getElementById('noResults');
    const searchInput = document.getElementById('searchInput');
    const gameCount = document.getElementById('gameCount');
    const scrollSentinel = document.getElementById('scrollSentinel');
    
    // New DOM Elements
    const themePicker = document.getElementById('themePicker');
    const categoryTabs = document.getElementById('categoryTabs');
    const favCount = document.getElementById('favCount');
    const recentSection = document.getElementById('recentSection');
    const recentGrid = document.getElementById('recentGrid');
    
    // State
    let allGames = [];
    let currentTab = 'all'; // 'all' or 'favorites'
    
    // Pagination State
    let currentRenderList = [];
    let renderIndex = 0;
    const BATCH_SIZE = 50;
    
    // LocalStorage State
    let favorites = JSON.parse(localStorage.getItem('vault_favorites') || '[]');
    let recentGames = JSON.parse(localStorage.getItem('vault_recent') || '[]');
    let currentTheme = localStorage.getItem('vault_theme') || 'pink';

    // Apply theme on load
    applyTheme(currentTheme);

    // Configuration
    const coverURL = "https://cdn.jsdelivr.net/gh/freebuisness/covers@main";
    const htmlURL = "https://cdn.jsdelivr.net/gh/freebuisness/html@main";

    async function fetchGames() {
        try {
            let sha = 'main';
            try {
                const shaRes = await fetch("https://api.github.com/repos/freebuisness/assets/commits?t=" + Date.now());
                if (shaRes.ok) {
                    const shaJson = await shaRes.json();
                    sha = shaJson[0].sha;
                }
            } catch(e) {
                console.warn("Could not fetch latest SHA, defaulting to main.");
            }
            
            const zonesURL = `https://cdn.jsdelivr.net/gh/freebuisness/assets@${sha}/zones.json`;
            const response = await fetch(zonesURL + "?t=" + Date.now());
            
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            
            allGames = data.filter(game => game.id !== -1);
            
            // Render UI
            updateFavCount();
            renderRecentGames();
            renderGames(allGames);
            
            if(loadingIndicator) loadingIndicator.style.display = 'none';
            
        } catch (error) {
            console.error("Failed to fetch games:", error);
            if(loadingIndicator) {
                loadingIndicator.innerHTML = `
                    <div style="color: #FF3366; font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
                    <p>Failed to connect to the game servers.</p>
                    <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary); border: none; color: white; border-radius: 4px; cursor: pointer;">Retry</button>
                `;
            }
        }
    }

    function renderGames(gamesToRender) {
        if (!gameGrid) return; // For pages without it
        
        currentRenderList = gamesToRender;
        renderIndex = 0;
        gameGrid.innerHTML = '';
        
        if (currentTab === 'all' && gameCount) {
            gameCount.textContent = `(${gamesToRender.length})`;
        } else if (gameCount) {
            gameCount.textContent = ''; // hide count on favorites tab in All Games title
        }
        
        if (gamesToRender.length === 0) {
            gameGrid.style.display = 'none';
            if (noResults) noResults.style.display = 'block';
            return;
        }
        
        gameGrid.style.display = 'grid';
        if (noResults) noResults.style.display = 'none';

        renderNextBatch();
    }

    function renderNextBatch() {
        if (!gameGrid || renderIndex >= currentRenderList.length) return;

        const fragment = document.createDocumentFragment();
        const endIndex = Math.min(renderIndex + BATCH_SIZE, currentRenderList.length);

        for (let i = renderIndex; i < endIndex; i++) {
            const game = currentRenderList[i];
            const card = document.createElement('a');
            card.className = 'game-card';
            
            // Resolve URL
            let targetUrl = '';
            if (game.url.startsWith("http")) {
                targetUrl = game.url;
                card.target = "_blank";
            } else {
                const resolvedUrl = game.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
                targetUrl = `play.html?url=${encodeURIComponent(resolvedUrl)}&title=${encodeURIComponent(game.name)}`;
            }
            card.href = targetUrl;
            
            // Track Recently Played and Favorites
            card.addEventListener('click', (e) => {
                if (e.target.closest('.fav-btn')) {
                    e.preventDefault();
                    toggleFavorite(game.id);
                    return;
                }
                addToRecent(game.id);
            });

            // Resolve cover URL
            const resolvedCover = game.cover ? game.cover.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL) : '';
            const isFav = favorites.includes(game.id);

            card.innerHTML = `
                <div class="game-image-container">
                    <img src="${resolvedCover}" alt="${game.name}" class="game-image" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBmaWxsPSIjMWExZTI5Ij48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+'">
                    
                    <div class="fav-btn ${isFav ? 'active' : ''}" title="Toggle Favorite">
                        <svg class="fav-icon" viewBox="0 0 24 24">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </div>

                    <div class="play-overlay">
                        <svg class="play-icon" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>
                <div class="game-info">
                    <h3 class="game-title">${game.name}</h3>
                    <p class="game-author">${game.author ? 'by ' + game.author : 'Unknown Author'}</p>
                </div>
            `;
            
            fragment.appendChild(card);
        }

        gameGrid.appendChild(fragment);
        renderIndex = endIndex;
    }

    // Set up Infinite Scrolling
    if (scrollSentinel) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                renderNextBatch();
            }
        }, { rootMargin: '200px' });
        observer.observe(scrollSentinel);
    }

    // --- Favorites Logic ---
    function toggleFavorite(id) {
        if (favorites.includes(id)) {
            favorites = favorites.filter(favId => favId !== id);
        } else {
            favorites.push(id);
        }
        localStorage.setItem('vault_favorites', JSON.stringify(favorites));
        updateFavCount();
        
        filterAndRender(); // Re-render to show/hide hearts or remove from favorites view
    }

    function updateFavCount() {
        if (favCount) {
            favCount.textContent = favorites.length;
        }
    }

    // --- Recently Played Logic ---
    function addToRecent(id) {
        recentGames = recentGames.filter(gId => gId !== id); // remove if exists
        recentGames.unshift(id); // add to front
        if (recentGames.length > 10) recentGames.pop(); // keep only top 10
        
        localStorage.setItem('vault_recent', JSON.stringify(recentGames));
    }

    function renderRecentGames() {
        if (!recentSection || !recentGrid) return;
        
        if (recentGames.length === 0) {
            recentSection.style.display = 'none';
            return;
        }
        
        recentSection.style.display = 'block';
        recentGrid.innerHTML = '';
        
        const recentGameObjects = recentGames.map(id => allGames.find(g => g.id === id)).filter(Boolean);
        
        recentGameObjects.forEach(game => {
            const card = document.createElement('a');
            card.className = 'game-card recent-card';
            
            // Resolve URL
            let targetUrl = '';
            if (game.url.startsWith("http")) {
                targetUrl = game.url;
                card.target = "_blank";
            } else {
                const resolvedUrl = game.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
                targetUrl = `play.html?url=${encodeURIComponent(resolvedUrl)}&title=${encodeURIComponent(game.name)}`;
            }
            card.href = targetUrl;
            
            card.addEventListener('click', () => addToRecent(game.id));

            // Resolve cover URL
            const resolvedCover = game.cover ? game.cover.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL) : '';

            card.innerHTML = `
                <div class="game-image-container">
                    <img src="${resolvedCover}" alt="${game.name}" class="game-image" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBmaWxsPSIjMWExZTI5Ij48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+'">
                    <div class="play-overlay">
                        <svg class="play-icon" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>
                <div class="game-info">
                    <h3 class="game-title">${game.name}</h3>
                </div>
            `;
            recentGrid.appendChild(card);
        });
    }

    // --- Search & Filtering Logic ---
    function filterAndRender() {
        let filtered = allGames;
        
        // Tab Filter
        if (currentTab === 'favorites') {
            filtered = filtered.filter(game => favorites.includes(game.id));
        }
        
        // Search Filter
        if (searchInput) {
            const query = searchInput.value.toLowerCase().trim();
            if (query !== '') {
                filtered = filtered.filter(game => {
                    return game.name.toLowerCase().includes(query) || 
                           (game.author && game.author.toLowerCase().includes(query)) ||
                           (game.special && game.special.some(tag => tag.toLowerCase().includes(query)));
                });
            }
        }
        
        renderGames(filtered);
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    if (categoryTabs) {
        categoryTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            
            // Update active state
            categoryTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentTab = btn.dataset.tab;
            filterAndRender();
            
            // Hide recent section if on favorites tab
            if (currentTab === 'favorites') {
                if (recentSection) recentSection.style.display = 'none';
            } else {
                renderRecentGames();
            }
        });
    }

    // --- Theme Switcher Logic ---
    function applyTheme(theme) {
        document.body.className = ''; // reset
        if (theme !== 'pink') {
            document.body.classList.add(`theme-${theme}`);
        }
        
        // Update active dot
        if (themePicker) {
            themePicker.querySelectorAll('.theme-dot').forEach(dot => {
                dot.classList.toggle('active', dot.dataset.theme === theme);
            });
        }
    }

    if (themePicker) {
        themePicker.addEventListener('click', (e) => {
            if (e.target.classList.contains('theme-dot')) {
                const theme = e.target.dataset.theme;
                currentTheme = theme;
                localStorage.setItem('vault_theme', theme);
                applyTheme(theme);
            }
        });
    }

    // Start fetching games
    if (gameGrid) {
        fetchGames();
    }
});
