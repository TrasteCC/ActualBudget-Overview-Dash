'use client';

import React, { useState } from 'react';

import { X, Save, Tag, User, Loader2 } from 'lucide-react';

interface Metadata {
    allCategories: { id: string; name: string }[];
    allPayees: { id: string; name: string }[];
}

interface Transaction {
    id: string;
    date: string;
    amount: number;
    payee: string;
    category: string;
    notes: string;
    categoryId?: string;
    payeeId?: string;
}

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
    metadata: Metadata | null;
    onSave: (id: string, updates: Record<string, unknown>) => Promise<void>;
}

export function EditTransactionModal({ isOpen, onClose, transaction, metadata, onSave }: EditModalProps) {
    // The parent keys this component by transaction id, so state initializes per transaction.
    const [categoryId, setCategoryId] = useState(transaction?.categoryId || '');
    const [payeeId, setPayeeId] = useState(transaction?.payeeId || '');
    const [notes, setNotes] = useState(transaction?.notes || '');
    const [amount, setAmount] = useState<number | string>(transaction?.amount || '');
    const [date, setDate] = useState(transaction?.date || '');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen || !transaction) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(transaction.id, {
                category: categoryId,
                payee: payeeId,
                notes: notes,
                amount: typeof amount === 'string' ? parseFloat(amount) : amount,
                date: date
            });
            onClose();
        } catch (error) {
            console.error('Failed to save transaction:', error);
            alert('Could not save the changes');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md p-6 rounded-2xl border border-[#1e2835] shadow-2xl bg-[#0d121b] relative">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6">
                    <h2 className="text-lg font-bold text-white italic uppercase tracking-tight mb-1">Edit Transaction</h2>
                    <p className="text-xs text-white/40 font-medium">Update the category, payee, or notes for this transaction.</p>
                </div>

                <div className="space-y-4">
                    {/* Payee Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                            <User className="w-3 h-3" /> Payee
                        </label>
                        <select
                            value={payeeId}
                            onChange={(e) => setPayeeId(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none transition-all"
                        >
                            <option value="" className="bg-[#0d121b]">Select payee...</option>
                            {(metadata?.allPayees || []).sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                                <option key={p.id} value={p.id} className="bg-[#0d121b]">{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Category Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                            <Tag className="w-3 h-3" /> Category
                        </label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none transition-all"
                        >
                            <option value="" className="bg-[#0d121b]">Select category...</option>
                            {(metadata?.allCategories || []).sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                <option key={c.id} value={c.id} className="bg-[#0d121b]">{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Amount & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                                Amount
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none transition-all [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add a description..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px] transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white/60 font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>

            </div>
        </div>
    );
}
