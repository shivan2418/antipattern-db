import { useState } from 'react';
import './App.css';
import { createBrowserTypedClient } from '../../src/browser';

interface Card {
  id: string;
  name: string;
  set: string;
  rarity: string;
  cost?: number;
  releasedAt: string;
  colors: string[];
}

interface Artist extends Record<string, unknown> {
  id: string;
  name: string;
  cards: Card[];
  cardCount: number;
}

// Create the client instance
const db = createBrowserTypedClient<Artist>('/');

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for array filtering demo
  const [selectedSet, setSelectedSet] = useState('');
  const [minCost, setMinCost] = useState<number | ''>('');
  const [selectedColor, setSelectedColor] = useState('');

  const initializeDB = async () => {
    try {
      setLoading(true);
      await db.init();
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize database');
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    if (!searchTerm.trim() || !initialized) return;

    try {
      setLoading(true);
      setError(null);

      // Build query with chained where statements
      let q = db.query().where('name').contains(searchTerm);

      // Apply array filters using the new simplified syntax
      if (selectedSet) {
        q = q.where('cards.set' as any).equals(selectedSet);
      }

      if (minCost !== '') {
        q = q.where('cards.cost' as any).greaterThanOrEqual(Number(minCost));
      }

      if (selectedColor) {
        q = q.where('cards.colors' as any).contains(selectedColor);
      }

      const result = await q.limit(10).exec();
      setResults(result.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedSet('');
    setMinCost('');
    setSelectedColor('');
    if (searchTerm) {
      search(); // Re-search without filters
    }
  };

  return (
    <div className="App">
      <h1>Magic: The Gathering Artist Database</h1>
      <p>Search for artists and filter their cards using chained .where() statements!</p>

      {!initialized ? (
        <div>
          <button onClick={initializeDB} disabled={loading}>
            {loading ? 'Initializing...' : 'Initialize Database'}
          </button>
        </div>
      ) : (
        <div>
          <div
            style={{
              marginBottom: '20px',
              padding: '20px',
              border: '1px solid #ddd',
              borderRadius: '8px',
            }}
          >
            <h3>Search Artist</h3>
            <div style={{ marginBottom: '10px' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Enter artist name (e.g., John Avon)"
                style={{ padding: '8px', width: '300px', marginRight: '10px' }}
              />
              <button onClick={search} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            <h4>Array Filters (using chained .where() statements)</h4>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label>Filter by Set: </label>
                <select
                  value={selectedSet}
                  onChange={e => setSelectedSet(e.target.value)}
                  style={{ padding: '4px' }}
                >
                  <option value="">All Sets</option>
                  <option value="BRO">BRO (The Brothers' War)</option>
                  <option value="DMU">DMU (Dominaria United)</option>
                  <option value="ONE">ONE (Phyrexia: All Will Be One)</option>
                  <option value="MOM">MOM (March of the Machine)</option>
                  <option value="LTR">LTR (The Lord of the Rings)</option>
                </select>
              </div>

              <div>
                <label>Min Mana Cost: </label>
                <input
                  type="number"
                  value={minCost}
                  onChange={e => setMinCost(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  max="20"
                  style={{ padding: '4px', width: '60px' }}
                />
              </div>

              <div>
                <label>Contains Color: </label>
                <select
                  value={selectedColor}
                  onChange={e => setSelectedColor(e.target.value)}
                  style={{ padding: '4px' }}
                >
                  <option value="">Any Color</option>
                  <option value="White">White</option>
                  <option value="Blue">Blue</option>
                  <option value="Black">Black</option>
                  <option value="Red">Red</option>
                  <option value="Green">Green</option>
                </select>
              </div>

              <button onClick={clearFilters} style={{ padding: '4px 8px' }}>
                Clear Filters
              </button>
            </div>

            {(selectedSet || minCost !== '' || selectedColor) && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px',
                  background: '#f0f8ff',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <strong>Active Filters:</strong>
                {selectedSet && ` Set="${selectedSet}"`}
                {minCost !== '' && ` Cost≥${minCost}`}
                {selectedColor && ` Color="${selectedColor}"`}
                <br />
                <strong>Query:</strong> {`query().where('name').contains('${searchTerm}')`}
                {selectedSet && `.where('cards.set').equals('${selectedSet}')`}
                {minCost !== '' && `.where('cards.cost').greaterThanOrEqual(${minCost})`}
                {selectedColor && `.where('cards.colors').contains('${selectedColor}')`}
              </div>
            )}
          </div>

          {error && <div style={{ color: 'red', marginBottom: '20px' }}>Error: {error}</div>}

          {results.length > 0 && (
            <div>
              <h3>Results ({results.length} artists found)</h3>
              {results.map(artist => (
                <div
                  key={artist.id}
                  style={{
                    border: '1px solid #ccc',
                    margin: '10px 0',
                    padding: '15px',
                    borderRadius: '8px',
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>{artist.name}</h4>
                  <p style={{ margin: '5px 0', color: '#666' }}>
                    <strong>Cards shown:</strong> {artist.cardCount}
                    {(selectedSet || minCost !== '' || selectedColor) &&
                      ` (filtered from original ${artist.cardCount} cards)`}
                  </p>

                  {artist.cards && artist.cards.length > 0 ? (
                    <div style={{ marginTop: '10px' }}>
                      <strong>Cards:</strong>
                      <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                        {artist.cards.slice(0, 10).map(card => (
                          <li key={card.id} style={{ marginBottom: '5px', fontSize: '14px' }}>
                            <strong>{card.name}</strong>
                            <span style={{ color: '#666' }}>
                              {' '}
                              ({card.set}, {card.rarity}
                              {card.cost !== undefined && `, Cost: ${card.cost}`}
                              {card.colors.length > 0 && `, Colors: ${card.colors.join(', ')}`})
                            </span>
                          </li>
                        ))}
                        {artist.cards.length > 10 && (
                          <li style={{ color: '#888', fontStyle: 'italic' }}>
                            ...and {artist.cards.length - 10} more cards
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>
                      No cards match the current filters
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && searchTerm && !loading && (
            <p>No artists found matching "{searchTerm}"</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
