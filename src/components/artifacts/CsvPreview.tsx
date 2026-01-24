import { useMemo, useState, useCallback } from 'react';
import { ArrowUpDown, Search, Copy, Check, ArrowUp, ArrowDown } from 'lucide-react';
import './ArtifactPreview.css';

interface CsvPreviewProps {
  content: string;
}

function parseCSV(content: string): string[][] {
  const lines = content.split('\n');
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          cell += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          cell += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(cell.trim());
          cell = '';
        } else {
          cell += char;
        }
      }
    }
    row.push(cell.trim());
    result.push(row);
  }

  return result;
}

export function CsvPreview({ content }: CsvPreviewProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const rawData = useMemo(() => parseCSV(content), [content]);

  const headers = rawData[0] || [];
  const rows = rawData.slice(1);

  // Filter rows based on search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(row =>
      row.some(cell => cell.toLowerCase().includes(term))
    );
  }, [rows, searchTerm]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (sortColumn === null) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

      // Try numeric comparison
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const handleSort = (columnIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sortColumn === columnIndex) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
  };

  const handleSelectColumn = (columnIndex: number) => {
    setSelectedColumn(prev => prev === columnIndex ? null : columnIndex);
    setCopied(false);
  };

  const handleCopyColumn = useCallback(async () => {
    if (selectedColumn === null) return;

    const columnData = [
      headers[selectedColumn],
      ...sortedRows.map(row => row[selectedColumn] || '')
    ].join('\n');

    try {
      await navigator.clipboard.writeText(columnData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy column:', err);
    }
  }, [selectedColumn, headers, sortedRows]);

  if (rawData.length === 0) {
    return (
      <div className="csv-preview-empty">
        <span>No data to display</span>
      </div>
    );
  }

  return (
    <div className="csv-preview">
      <div className="csv-toolbar">
        <div className="csv-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="csv-toolbar-right">
          {selectedColumn !== null && (
            <button className="csv-copy-btn" onClick={handleCopyColumn}>
              {copied ? (
                <>
                  <Check size={14} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Column</span>
                </>
              )}
            </button>
          )}
          <div className="csv-stats">
            {filteredRows.length} of {rows.length} rows
            {selectedColumn !== null && (
              <span className="csv-selected-info"> · Column "{headers[selectedColumn]}" selected</span>
            )}
          </div>
        </div>
      </div>
      <div className="csv-table-container">
        <table>
          <thead>
            <tr>
              <th className="row-number">#</th>
              {headers.map((header, i) => (
                <th
                  key={i}
                  onClick={() => handleSelectColumn(i)}
                  className={`${sortColumn === i ? 'sorted' : ''} ${selectedColumn === i ? 'selected' : ''}`}
                >
                  <span className="header-content">
                    <span className="header-text">{header}</span>
                    <button
                      className="sort-btn"
                      onClick={(e) => handleSort(i, e)}
                      title="Sort column"
                    >
                      {sortColumn === i ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="sort-icon" />
                      )}
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="row-number">{rowIndex + 1}</td>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    title={cell}
                    className={selectedColumn === cellIndex ? 'selected' : ''}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
