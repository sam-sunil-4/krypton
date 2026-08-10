import { useState } from 'react';

export default function LogFilter() {
  const [search, setSearch] = useState('');
  const [levels, setLevels] = useState({
    debug: false,
    info: true,
    warn: true,
    error: true,
    fatal: true
  });
  const [timeRange, setTimeRange] = useState('1h');

  const toggleLevel = (level: keyof typeof levels) => {
    setLevels({ ...levels, [level]: !levels[level] });
  };

  return (
    <div className="glass-panel p-3 rounded-lg flex flex-wrap gap-4 items-center">
      <div className="flex-1 min-w-[200px]">
        <input 
          type="text" 
          className="input !mb-0" 
          placeholder="Filter logs (regex supported)..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      
      <div className="flex items-center gap-2 border-r border-light pr-4">
        <span className="text-xs text-muted font-semibold uppercase">Levels</span>
        {(Object.keys(levels) as Array<keyof typeof levels>).map(level => (
          <label key={level} className={`cursor-pointer flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${levels[level] ? (level === 'error' || level === 'fatal' ? 'bg-error-bg text-error border-error/30' : level === 'warn' ? 'bg-warning-bg text-warning border-warning/30' : 'bg-primary-base/20 text-primary-light border-primary-base/30') : 'bg-transparent text-muted border-light hover:border-medium'}`}>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={levels[level]} 
              onChange={() => toggleLevel(level)} 
            />
            {level.toUpperCase()}
          </label>
        ))}
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted font-semibold uppercase">Time</span>
        <select className="input !w-auto !py-1 !text-xs" value={timeRange} onChange={e => setTimeRange(e.target.value)}>
          <option value="5m">Last 5 min</option>
          <option value="15m">Last 15 min</option>
          <option value="1h">Last 1 hour</option>
          <option value="6h">Last 6 hours</option>
          <option value="24h">Last 24 hours</option>
        </select>
      </div>
      
      <button className="btn btn-secondary text-xs py-1">Clear Filters</button>
    </div>
  );
}
