import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import ReactMarkdown from 'https://esm.sh/react-markdown@^9.0.0';
import { 
  Transaction, 
  Category, 
  TransactionType, 
  AnimalSpecies, 
  AnimalLog, 
  InventoryItem, 
  Asset, 
  Liability 
} from '../types.ts';
import { COLORS } from '../constants.tsx';
import { getFinancialAdvice } from '../services/geminiService.ts';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  animalSpecies: AnimalSpecies[];
  animalLogs: AnimalLog[];
  inventoryItems: InventoryItem[];
  inventoryMovements: any[];
  assets: Asset[];
  liabilities: Liability[];
}

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, 
  categories, 
  animalSpecies, 
  animalLogs, 
  inventoryItems, 
  assets, 
  liabilities 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const isSearchActive = searchQuery.trim().length > 0;

  const summary = useMemo(() => {
    return transactions.reduce((acc, t) => {
      if (t.type === TransactionType.INCOME) acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [transactions]);

  const performanceMetrics = useMemo(() => {
    const revenue = summary.income;
    const expenses = summary.expense;
    
    const grossMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
    const breakevenProgress = expenses > 0 ? Math.min((revenue / expenses) * 100, 100) : (revenue > 0 ? 100 : 0);
    const gapToBreakeven = Math.max(0, expenses - revenue);

    // Top 3 expense categories
    const expenseData: { [key: string]: number } = {};
    transactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId)?.name || 'Other';
      expenseData[cat] = (expenseData[cat] || 0) + t.amount;
    });

    const topExpenses = Object.entries(expenseData)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, value]) => ({ name, value }));

    return { grossMargin, breakevenProgress, gapToBreakeven, topExpenses };
  }, [summary, transactions, categories]);

  const debtSummary = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const totalOutstanding = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);
    
    const upcoming = liabilities.filter(l => {
      if (!l.dueDate || l.currentBalance <= 0) return false;
      const due = new Date(l.dueDate);
      return due <= thirtyDaysFromNow;
    });

    const totalAmountDueSoon = upcoming.reduce((sum, l) => {
      return sum + (l.installmentAmount && l.installmentAmount > 0 ? Math.min(l.installmentAmount, l.currentBalance) : l.currentBalance);
    }, 0);

    return { totalOutstanding, upcoming, totalAmountDueSoon };
  }, [liabilities]);

  useEffect(() => {
    const fetchInsights = async () => {
      if (transactions.length < 5) return;
      setIsLoadingInsights(true);
      try {
        const advice = await getFinancialAdvice(transactions, categories);
        setAiInsights(advice || "Add more data to generate insights.");
      } catch (err) {
        setAiInsights("Unable to load insights at this time.");
      } finally {
        setIsLoadingInsights(false);
      }
    };
    fetchInsights();
  }, [transactions, categories]);

  const filteredResults = useMemo(() => {
    if (!isSearchActive) return null;

    const q = searchQuery.toLowerCase();
    
    const containsQuery = (item: any, fields: string[]) => {
      return fields.some(field => {
        const val = item[field];
        return val && val.toString().toLowerCase().includes(q);
      });
    };

    return {
      transactions: transactions.filter(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        return containsQuery({...t, categoryName: cat?.name}, ['description', 'categoryName', 'date', 'amount']);
      }),
      animals: animalSpecies.filter(s => containsQuery(s, ['name', 'breed', 'tag'])),
      animalLogs: animalLogs.filter(l => {
        const species = animalSpecies.find(s => s.id === l.speciesId);
        return containsQuery({...l, speciesName: species?.name}, ['speciesName', 'note', 'type', 'date']);
      }),
      inventory: inventoryItems.filter(i => containsQuery(i, ['name', 'sku', 'description'])),
      assets: assets.filter(a => containsQuery(a, ['name', 'category', 'description', 'purchaseDate'])),
      liabilities: liabilities.filter(l => containsQuery(l, ['name', 'category', 'description', 'dueDate'])),
    };
  }, [isSearchActive, searchQuery, transactions, categories, animalSpecies, animalLogs, inventoryItems, assets, liabilities]);

  const categoryData = useMemo(() => {
    const data: { [key: string]: number } = {};
    transactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId)?.name || 'Other';
      data[cat] = (data[cat] || 0) + t.amount;
    });
    return Object.keys(data).map((name, index) => ({
      name,
      value: data[name],
      color: COLORS[index % COLORS.length]
    }));
  }, [transactions, categories]);

  const monthlyData = useMemo(() => {
    const data: { [key: string]: { month: string, income: number, expense: number, sortKey: string } } = {};
    transactions.forEach(t => {
      const date = new Date(t.date);
      const sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = date.toLocaleDateString('default', { month: 'short', year: '2-digit' });
      if (!data[sortKey]) data[sortKey] = { month: label, income: 0, expense: 0, sortKey };
      if (t.type === TransactionType.INCOME) data[sortKey].income += t.amount;
      else data[sortKey].expense += t.amount;
    });
    return Object.values(data).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [transactions]);

  const getDayStatusStyles = (dueDate: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return { label: `${Math.abs(days)}d Overdue`, class: 'text-rose-600 bg-rose-50 border-rose-100 animate-pulse' };
    if (days === 0) return { label: 'Due Today', class: 'text-amber-600 bg-amber-50 border-amber-100' };
    if (days <= 7) return { label: `Due in ${days}d`, class: 'text-amber-600 bg-amber-50 border-amber-100' };
    return { label: `Due in ${days}d`, class: 'text-slate-500 bg-slate-50 border-slate-100' };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Search Bar */}
      <div className="bg-white/40 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-sm">
        <div className="flex flex-col space-y-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Global Farm Search</h2>
          <div className="relative">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search animals, inventory, ledger or assets..."
              className="w-full pl-10 pr-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-inner text-slate-700 transition-all"
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Global Search Results */}
      {isSearchActive && filteredResults && (
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-emerald-100 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-emerald-800">Unified Results for "{searchQuery}"</h3>
            <button onClick={() => setSearchQuery('')} className="text-xs font-bold text-slate-400 hover:text-rose-500 uppercase tracking-tighter transition-colors">Clear Search</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            {filteredResults.transactions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Ledger Items</h4>
                {filteredResults.transactions.map(t => (
                  <div key={t.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-emerald-200 transition-all group">
                    <p className="text-sm font-bold text-slate-800 truncate">{t.description}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-slate-400 font-mono">{t.date}</span>
                      <span className={`text-xs font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ${t.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Add more filtered results sections here if needed */}
          </div>
        </div>
      )}

      {/* Primary Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">${summary.income.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expenses</p>
          <p className="text-xl font-bold text-rose-600 mt-1">${summary.expense.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Income</p>
          <p className={`text-xl font-bold mt-1 ${summary.income - summary.expense >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
            ${(summary.income - summary.expense).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Debt</p>
          <p className="text-xl font-bold text-rose-600 mt-1">${debtSummary.totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-rose-100 bg-rose-50/10">
          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Due Soon (30d)</p>
          <p className="text-xl font-bold text-rose-700 mt-1">${debtSummary.totalAmountDueSoon.toLocaleString()}</p>
        </div>
      </div>

      {/* Operational Health & Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform duration-500" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Gross Profit Margin</h4>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900">{performanceMetrics.grossMargin.toFixed(1)}%</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
              performanceMetrics.grossMargin > 20 ? 'bg-emerald-100 text-emerald-700' :
              performanceMetrics.grossMargin > 0 ? 'bg-amber-100 text-amber-700' :
              'bg-rose-100 text-rose-700'
            }`}>
              {performanceMetrics.grossMargin > 20 ? 'Healthy' : performanceMetrics.grossMargin > 0 ? 'Thin' : 'Loss'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-medium">Earnings retained after covering all expenses</p>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-sm group">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Breakeven Analysis</h4>
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>{performanceMetrics.breakevenProgress.toFixed(0)}% Covered</span>
              <span>Gap: ${performanceMetrics.gapToBreakeven.toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${performanceMetrics.breakevenProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                style={{ width: `${performanceMetrics.breakevenProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Revenue progress against total expense load</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Top Expense Segments</h4>
          <div className="space-y-2">
            {performanceMetrics.topExpenses.length > 0 ? performanceMetrics.topExpenses.map((exp, idx) => (
              <div key={idx} className="flex items-center justify-between group">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-xs font-bold text-slate-700">{exp.name}</span>
                </div>
                <span className="text-xs font-black text-slate-900">${exp.value.toLocaleString()}</span>
              </div>
            )) : <p className="text-xs text-slate-400 italic py-2">No expenses recorded yet.</p>}
          </div>
        </div>
      </div>

      {/* Charts & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Income vs Expenses</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
                  <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">AI Financial Insights</h3>
            </div>
            {isLoadingInsights ? (
              <div className="flex items-center space-x-3 text-slate-400 animate-pulse">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 4v4m0 8v4m8-12h-4m-8 0H4" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="text-sm font-medium">Gemini is analyzing your farm records...</span>
              </div>
            ) : aiInsights ? (
              <div className="prose prose-sm max-w-none text-slate-600">
                <ReactMarkdown>{aiInsights}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Add more transactions to unlock AI-powered insights.</p>
            )}
          </div>
        </div>

        {/* Payment Alerts Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-800">Payment Alerts</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100">
                {debtSummary.upcoming.length} Items
              </span>
            </div>
            
            <div className="space-y-4">
              {debtSummary.upcoming.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold">No upcoming payments</p>
                </div>
              ) : (
                debtSummary.upcoming.map(l => {
                  const status = getDayStatusStyles(l.dueDate!);
                  return (
                    <div key={l.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-slate-800">{l.name}</p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border shrink-0 ${status.class}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-lg font-black text-rose-600">${(l.installmentAmount || l.currentBalance).toLocaleString()}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;