import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { addMonths } from 'date-fns';

// --- Types ---
export interface FilterState {
  startDate: Date;
  endDate: Date;
  technology: string;
  client: string;
  ticketType: string;
  assignedTo: string;
  status: string;
  ticketNumber: string;
}

export interface TicketData {
  id: string | number;
  date: Date | string;
  technology: string;
  client: string;
  ticketType: string;
  assignedTo: string;
  status: string;
  ticketNumber: string;
  responseTime?: number;
  satisfaction?: number;
  [key: string]: any;
}

// --- Context Interface ---
interface DashboardContextType {
  rawData: any[] | null;
  processedData: TicketData[] | null;
  filteredData: TicketData[] | null;
  selectedTickets: TicketData[] | null;
  selectedCategory: string | null;
  selectedValue: string | null;
  filters: FilterState;
  uniqueValues: Record<keyof Omit<FilterState, 'startDate' | 'endDate'>, string[]>;
  isLoading: boolean;
  isDarkMode: boolean;
  isPanelOpen: boolean;
  updateFilters: (newFilters: Partial<FilterState>, applyImmediately?: boolean) => void;
  resetFilters: () => void;
  applyFilters: (filtersToApply?: FilterState) => void;
  loadExcelData: (data: any[]) => void;
  toggleDarkMode: () => void;
  selectTicketsByCategory: (category: string, value: string) => void;
  clearSelectedTickets: () => void;
  togglePanel: () => void;
}

// --- Create Context ---
export const DashboardContext = createContext<DashboardContextType>({} as DashboardContextType);

// --- Normalize status values ---
const normalizeStatus = (status: string): string => {
  if (!status) return 'Unknown';
  const s = status.trim().toLowerCase();

  if (['in progress', 'hold', 'in review'].includes(s)) return 'Open';
  if (['closed', 'resolved'].includes(s)) return 'Closed';

  return 'Unknown';
};
// --- openticstatus: string[] = ['In Progress', 'Hold', 'Review', 'Open'];
// const closedTicketStatus: string[] = ['Closed', 'Resolved'];ket



export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const defaultStartDate = addMonths(new Date(), -2);
  const defaultEndDate = new Date();

  const [rawData, setRawData] = useState<any[] | null>(null);
  const [processedData, setProcessedData] = useState<TicketData[] | null>(null);
  const [filteredData, setFilteredData] = useState<TicketData[] | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<TicketData[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  const [filters, setFilters] = useState<FilterState>({
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    technology: 'All',
    client: 'All',
    ticketType: 'All',
    assignedTo: 'All',
    status: 'All',
    ticketNumber: 'All',
  });

  const [uniqueValues, setUniqueValues] = useState<DashboardContextType['uniqueValues']>({
    technology: ['All'],
    client: ['All'],
    ticketType: ['All'],
    assignedTo: ['All'],
    status: ['All'],
    ticketNumber: ['All'],
  });

  // --- Extract unique dropdown options ---
  const extractUniqueValues = (data: TicketData[]) => {
    const unique = {
      technology: ['All'],
      client: ['All'],
      ticketType: ['All'],
      assignedTo: ['All'],
      status: ['All'],
      ticketNumber: ['All'],
    };

    data.forEach(ticket => {
      for (const key of Object.keys(unique) as (keyof typeof unique)[]) {
        const value = ticket[key] || ticket[key.charAt(0).toUpperCase() + key.slice(1)];
        if (value && !unique[key].includes(value)) {
          unique[key].push(value);
        }
      }
    });

    return unique;
  };

  // --- Process raw Excel data into TicketData format ---
  const processRawData = (data: any[]): TicketData[] => {
    return data.map((row, index) => ({
      id: row.ID || `ticket-${index}`,
      ticketNumber: row['Ticket Number'] || 'Unknown',
      date: row['Assigned Date'] || 'Unknown',
      technology: row['Technology/Platform'] || 'Unknown',
      client: row.Client || 'Unknown',
      ticketType: row['Ticket Type'] || 'Unknown',
      assignedTo: row.AssignedTo || row['Assigned to'] || 'Unassigned',
      status: normalizeStatus(row.Status || 'Unknown'),
      responseTime: null,
      satisfaction: null,
      ...row,
    }));
  };

  // --- Core Filter Logic ---
  const applyFilters = (filtersToApply?: FilterState) => {
    if (!processedData) return;

    const currentFilters = filtersToApply || filters;

    // Flush previous data and state
    setFilteredData([]);
    setSelectedTickets(null);
    setSelectedCategory(null);
    setSelectedValue(null);

    const filtered = processedData.filter((ticket) => {
      const ticketDate = new Date(ticket.date);

      const isDateInRange =
        ticketDate >= new Date(currentFilters.startDate) &&
        ticketDate <= new Date(currentFilters.endDate);

      const matchesTechnology =
        currentFilters.technology === 'All' || ticket.technology === currentFilters.technology;

      const matchesClient =
        currentFilters.client === 'All' || ticket.client === currentFilters.client;

      const matchesTicketType =
        currentFilters.ticketType === 'All' || ticket.ticketType === currentFilters.ticketType;

      const matchesAssignedTo =
        currentFilters.assignedTo === 'All' || ticket.assignedTo === currentFilters.assignedTo;

      // Status filter: support "All", "Open" (multiple statuses), "Closed" (multiple statuses), or exact match
      const openStatuses = ['In Progress', 'Hold', 'Review', 'Open'];
      const closedStatuses = ['Closed', 'Resolved'];

      const matchesStatus =
        currentFilters.status === 'All' ||
        (currentFilters.status === 'Open' && openStatuses.includes(ticket.status)) ||
        (currentFilters.status === 'Closed' && closedStatuses.includes(ticket.status)) ||
        ticket.status === currentFilters.status;

      const matchesTicketNumber =
        currentFilters.ticketNumber === 'All' || ticket.ticketNumber === currentFilters.ticketNumber;

      return (
        isDateInRange &&
        matchesTechnology &&
        matchesClient &&
        matchesTicketType &&
        matchesAssignedTo &&
        matchesStatus &&
        matchesTicketNumber
      );
    });

    setFilteredData(filtered);
  };

  // --- Exposed Actions ---
  const loadExcelData = (data: any[]) => {
    setIsLoading(true);
    const processed = processRawData(data);
    const unique = extractUniqueValues(processed);
    setRawData(data);
    setProcessedData(processed);
    setUniqueValues(unique);

    // Apply current filters to new data
    applyFilters(filters);

    setIsLoading(false);
  };

  const updateFilters = (newFilters: Partial<FilterState>, applyImmediately = false) => {
    setFilters((prev) => {
      const updatedFilters = { ...prev, ...newFilters };
      if (applyImmediately) {
        applyFilters(updatedFilters);
      }
      return updatedFilters;
    });
  };

  const resetFilters = () => {
    const reset = {
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      technology: 'All',
      client: 'All',
      ticketType: 'All',
      assignedTo: 'All',
      status: 'All',
      ticketNumber: 'All',
    };
    setFilters(reset);
    setFilteredData(processedData);
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
  };

  const selectTicketsByCategory = (category: string, value: string) => {
    if (!filteredData) return;
    let dataField = category.toLowerCase();

    if (dataField === 'technology') {
      const tickets = filteredData.filter(ticket => {
        const techValue = ticket['Technology/Platform'] || ticket.Technology || ticket.technology;
        return techValue === value;
      });
      setSelectedTickets(tickets);
    } else if (dataField === 'assignedto') {
      const tickets = filteredData.filter(ticket => {
        const assignedValue = ticket['Assigned to'] || ticket.AssignedTo || ticket['Assigned To'] || ticket.assignedTo;
        return assignedValue === value;
      });
      setSelectedTickets(tickets);
    } else if (dataField === 'tickettype') {
      const tickets = filteredData.filter(ticket => {
        const ticketTypeValue = ticket['Ticket Type'] || ticket.TicketType || ticket.ticketType;
        return ticketTypeValue === value;
      });
      setSelectedTickets(tickets);
    } else {
      const tickets = filteredData.filter(ticket => {
        if (String(ticket[dataField]) === value) return true;
        const capitalizedField = dataField.charAt(0).toUpperCase() + dataField.slice(1);
        if (String(ticket[capitalizedField]) === value) return true;
        const spacedField = dataField.replace(/([A-Z])/g, ' $1').trim();
        const capitalizedSpacedField = spacedField.charAt(0).toUpperCase() + spacedField.slice(1);
        return String(ticket[capitalizedSpacedField]) === value;
      });
      setSelectedTickets(tickets);
    }
    setSelectedCategory(category);
    setSelectedValue(value);
    setIsPanelOpen(true);
  };

  const clearSelectedTickets = () => {
    setSelectedTickets(null);
    setSelectedCategory(null);
    setSelectedValue(null);
    setIsPanelOpen(false);
  };

  const togglePanel = () => {
    setIsPanelOpen(prev => !prev);
  };

  // --- Init Theme ---
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
    if (prefersDark) document.documentElement.classList.add('dark');
  }, []);

  // --- Context Value ---
  const value: DashboardContextType = {
    rawData,
    processedData,
    filteredData,
    selectedTickets,
    selectedCategory,
    selectedValue,
    filters,
    uniqueValues,
    isLoading,
    isDarkMode,
    isPanelOpen,
    updateFilters,
    resetFilters,
    applyFilters,
    loadExcelData,
    toggleDarkMode,
    selectTicketsByCategory,
    clearSelectedTickets,
    togglePanel,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

// --- Hook to use context ---
export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

// type TicketData = {
//   status: string;
//   // Add other fields if needed
// };
