import React, { useState, useEffect } from 'react';
import { X, Delete, Lock, ShieldAlert } from 'lucide-react';

const PinModal = ({ isOpen, onClose, onSuccess }) => {
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);

    // Modes: 'verify' | 'setup' | 'confirm'
    const [mode, setMode] = useState('verify');
    const [tempPin, setTempPin] = useState("");

    // Persistent PIN Logic
    const getStoredPin = () => localStorage.getItem('karaoke_security_pin') || "0000";
    const savePin = (newPin) => localStorage.setItem('karaoke_security_pin', newPin);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setPin("");
            setError(false);
            setShake(false);
            setMode('verify');
            setTempPin("");
        }
    }, [isOpen]);

    const handleNumber = (num) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
            setError(false);
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError(false);
    };

    useEffect(() => {
        if (pin.length === 4) {
            const currentPin = getStoredPin();

            if (mode === 'verify') {
                if (pin === currentPin) {
                    if (currentPin === "0000") {
                        // First time use! Force setup
                        setMode('setup');
                        setPin("");
                    } else {
                        // Authorized!
                        onSuccess();
                    }
                } else {
                    handleWrongPin();
                }
            } else if (mode === 'setup') {
                setTempPin(pin);
                setMode('confirm');
                setPin("");
            } else if (mode === 'confirm') {
                if (pin === tempPin) {
                    savePin(pin);
                    onSuccess();
                } else {
                    setError(true);
                    setShake(true);
                    setTimeout(() => setShake(false), 500);
                    // Reset to setup mode on mismatch
                    setTimeout(() => {
                        setMode('setup');
                        setPin("");
                    }, 1000);
                }
            }
        }
    }, [pin, mode, tempPin, onSuccess]);

    const handleWrongPin = () => {
        setError(true);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setTimeout(() => setPin(""), 1000);
    };

    if (!isOpen) return null;

    const getTitle = () => {
        if (mode === 'verify') return "Confirm Identity";
        if (mode === 'setup') return "Set New PIN";
        if (mode === 'confirm') return "Confirm New PIN";
        return "";
    };

    const getSubtitle = () => {
        if (mode === 'verify') return "Enter PIN to authorize action";
        if (mode === 'setup') return "Choose a new 4-digit security code";
        if (mode === 'confirm') return "Re-enter the new PIN to save";
        return "";
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`bg-slate-900 border border-white/10 w-full max-w-xs rounded-3xl p-6 shadow-2xl transition-transform duration-300 ${shake ? 'animate-shake' : 'scale-100'}`}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 text-red-400">
                        <Lock size={18} />
                        <span className="text-xs font-bold uppercase tracking-tighter">
                            {mode === 'verify' ? 'Security Lock' : 'PIN Setup'}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-full transition">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className={`p-3 rounded-2xl transition-colors duration-500 ${mode === 'verify' ? 'bg-red-500/10 text-red-500' : 'bg-fuchsia-500/10 text-fuchsia-500'}`}>
                            {mode === 'verify' ? <ShieldAlert size={32} /> : <Lock size={32} />}
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{getTitle()}</h3>
                    <p className="text-xs text-slate-400 tracking-tight">{getSubtitle()}</p>
                </div>

                {/* PIN Display */}
                <div className="flex justify-center gap-4 mb-10">
                    {[0, 1, 2, 3].map(i => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${i < pin.length
                                    ? (error ? 'bg-red-500 border-red-500 scale-125' : 'bg-fuchsia-500 border-fuchsia-500 scale-110')
                                    : 'border-slate-700'
                                }`}
                        />
                    ))}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleNumber(num.toString())}
                            className="h-14 bg-slate-800/50 hover:bg-slate-800 active:scale-95 text-xl font-bold text-white rounded-2xl transition-all border border-white/5"
                        >
                            {num}
                        </button>
                    ))}
                    <div />
                    <button
                        onClick={() => handleNumber("0")}
                        className="h-14 bg-slate-800/50 hover:bg-slate-800 active:scale-95 text-xl font-bold text-white rounded-2xl transition-all border border-white/5"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        className="h-14 bg-slate-800/50 hover:bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center transition-all border border-white/5"
                    >
                        <Delete size={20} />
                    </button>
                </div>

                {error && (
                    <p className="text-center text-red-500 text-[10px] font-bold mt-6 uppercase tracking-widest animate-pulse">
                        {mode === 'confirm' ? "PINs don't match" : "Incorrect PIN. Access Denied."}
                    </p>
                )}
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default PinModal;
