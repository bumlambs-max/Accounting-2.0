import { Transaction, Category, Account, AnimalSpecies, AnimalLog, InventoryItem, InventoryMovement, Asset, Liability, NavItemConfig } from '../types.ts';

export interface FarmData {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  animalSpecies: AnimalSpecies[];
  animalLogs: AnimalLog[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  assets: Asset[];
  liabilities: Liability[];
  sidebarConfig: NavItemConfig[];
  isSidebarCollapsed: boolean;
}

const STORAGE_PREFIX = 'farm_cloud_v1:';

export const ApiService = {
  /**
   * Pushes the entire farm state to the "Cloud".
   * In a real app, this would be a POST/PUT to a database.
   */
  async pushData(email: string, data: FarmData): Promise<void> {
    const key = STORAGE_PREFIX + email;
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // For now, we use LocalStorage to simulate the cloud.
    // Replace with: await fetch('/api/sync', { method: 'POST', body: JSON.stringify({ email, data }) });
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`[CloudSync] Data pushed for ${email}`);
  },

  /**
   * Pulls the entire farm state from the "Cloud".
   * In a real app, this would be a GET request.
   */
  async pullData(email: string): Promise<FarmData | null> {
    const key = STORAGE_PREFIX + email;
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Replace with: const response = await fetch(`/api/sync?email=${email}`); return response.json();
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    
    console.log(`[CloudSync] Data pulled for ${email}`);
    return JSON.parse(saved);
  }
};
