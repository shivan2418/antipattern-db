import { useState, useEffect } from 'react';
import { db } from './artist-db/client.js';
import type { GeneratedRecord } from './artist-db/types.js';
import './App.css';

function App() {
  const [artists, setArtists] = useState<GeneratedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredArtists, setFilteredArtists] = useState<GeneratedRecord[]>([]);

  useEffect(() => {
    const loadArtists = async () => {
      try {
        // Query the first 10 artists for demo
        const result = await db.query()
          .limit(10)
          .exec();
        
        setArtists(result.records);
        setFilteredArtists(result.records);
        setLoading(false);
      } catch (error) {
        console.error('Error loading artists:', error);
        setLoading(false);
      }
    };

    loadArtists();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = artists.filter(artist => 
        artist.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredArtists(filtered);
    } else {
      setFilteredArtists(artists);
    }
  }, [searchTerm, artists]);

  if (loading) {
    return <div className="loading">Loading artists...</div>;
  }

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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="artists-grid">
          {filteredArtists.map((artist) => (
            <div key={artist.id} className="artist-card">
              <h3>{artist.name}</h3>
              <p>Cards: {artist.cardCount}</p>
              <p>Oldest card: {new Date(artist.oldestCardDate).getFullYear()}</p>
              {artist.cards.length > 0 && (
                <div className="sample-cards">
                  <h4>Sample cards:</h4>
                  <ul>
                    {artist.cards.slice(0, 3).map((card) => (
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
      </header>
    </div>
  );
}

export default App;
