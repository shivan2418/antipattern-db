import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { db } from './artist-db/client';
import type { GeneratedRecord } from './artist-db/types';
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredArtists, setFilteredArtists] = useState<GeneratedRecord[]>([]);

  // Debounced search function
  const performSearch = useCallback(
    debounce(async (term: string) => {
      if (!term.trim()) {
        // If search term is empty, clear results
        setFilteredArtists([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      try {
        // Use efficient query with index-based search instead of loading all records
        const result = await db.query().where('name').contains(term).exec();

        setFilteredArtists(result.records || []);
      } catch (error) {
        console.error('Error searching artists:', error);
        setFilteredArtists([]);
      } finally {
        setSearching(false);
      }
    }, 300), // 300ms debounce delay
    []
  );

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    performSearch(value);
  };

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      performSearch.cancel();
    };
  }, [performSearch]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Antipattern-DB Demo</h1>
        <p>Exploring Magic: The Gathering artist database</p>

        <div className="search-container">
          <input
            type="text"
            placeholder="Search artists..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
          {searching && <span className="search-indicator">Searching...</span>}
        </div>

        {!searchTerm && filteredArtists.length === 0 && !searching && (
          <div className="search-prompt">Start typing to search for artists...</div>
        )}

        <div className="artists-grid">
          {filteredArtists.map(artist => (
            <div key={artist.id} className="artist-card">
              <h3>{artist.name}</h3>
              <p>Cards: {artist.cardCount}</p>
              <p>Oldest card: {new Date(artist.oldestCardDate).getFullYear()}</p>
              {artist.cards.length > 0 && (
                <div className="sample-cards">
                  <h4>Sample cards:</h4>
                  <ul>
                    {artist.cards.slice(0, 3).map(card => (
                      <li key={card.id}>
                        {card.name} ({card.set.toUpperCase()})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredArtists.length === 0 && searchTerm && !searching && (
          <div className="no-results">No artists found matching "{searchTerm}"</div>
        )}
      </header>
    </div>
  );
}

export default App;
