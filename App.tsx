import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import StaffDashboard from './components/StaffDashboard';
import AdminDashboard from './components/AdminDashboard';
import { UserRole } from './types';
import { Shield, User, LogOut, Heart, Sparkles, Moon, Sun, Lock } from 'lucide-react';
import { IS_LIVE_MODE } from './services/config';

// Safe access for PIN, defaults to 1234 if not set
// Using cast to 'any' to avoid TS errors in environments where ImportMeta type isn't fully defined
const ADMIN_PIN = (import.meta as any).env?.VITE_ADMIN_PIN || '1234';

const Layout: React.FC<{ children: React.ReactNode; role: UserRole; onLogout: () => void; isDarkMode: boolean; toggleTheme: () => void }> = ({ children, role, onLogout, isDarkMode, toggleTheme }) => {
  return (
    <div className="min-h-screen transition-colors duration-300">
      {/* Glassmorphism Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center space-x-3 group cursor-default">
                <div className="w-10 h-10 bg-gradient-to-tr from-brand-500 to-brand-400 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200 dark:shadow-none group-hover:scale-105 transition-transform">
                   <Heart className="text-white w-6 h-6" fill="currentColor" />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-slate-800 dark:text-white tracking-tight leading-none">CareWatch</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wide">FAMILY CONNECT</span>
                </div>
                
                {IS_LIVE_MODE ? (
                  <span className="ml-2 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Live</span>
                ) : (
                  <span className="ml-2 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Mock</span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="p-2.5 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 dark:hover:text-amber-300 transition-all duration-200"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="hidden md:flex flex-col items-end mr-2">
                 <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Logged in as</span>
                 <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{role === UserRole.ADMIN ? 'Administrator' : 'Care Staff'}</span>
              </div>
              <button 
                onClick={onLogout}
                className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all duration-200 border border-transparent hover:border-rose-100 dark:hover:border-rose-900"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="py-6 px-4">
        {children}
      </main>
    </div>
  );
};

const LoginSelection: React.FC<{ onSelect: (role: UserRole) => void; toggleTheme: () => void; isDarkMode: boolean }> = ({ onSelect, toggleTheme, isDarkMode }) => {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleAdminAuth = (e: React.FormEvent) => {
      e.preventDefault();
      if (pin === ADMIN_PIN) {
          onSelect(UserRole.ADMIN);
      } else {
          setError(true);
          setPin('');
      }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      {/* Theme Toggle Absolute */}
      <button 
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-3 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md shadow-sm hover:scale-110 transition-all text-slate-600 dark:text-slate-300"
      >
         {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      {/* Background decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50 animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-rose-100 dark:bg-rose-900/20 rounded-full blur-3xl opacity-50 animate-pulse-slow" style={{animationDelay: '1.5s'}}></div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        <div className="mb-10 text-center animate-fade-in-up">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-200 dark:shadow-brand-900/50 rotate-3 hover:rotate-6 transition-transform duration-300">
              <Heart className="text-white w-10 h-10" fill="white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-3">
            Elderly Care Watch <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-indigo-600 dark:from-brand-400 dark:to-indigo-400">Family Connect</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Secure, real-time updates for peace of mind. Bridging the gap between care homes and families with AI-powered communication.
          </p>
        </div>

        {/* Modal-like card for role selection */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/50 dark:border-slate-700 w-full max-w-md animate-fade-in-up transition-all duration-300">
            
            {!showAdminLogin ? (
                <div className="space-y-4">
                     <p className="text-center text-slate-500 dark:text-slate-400 font-medium mb-6 uppercase tracking-wider text-xs">Select your access level</p>
                     
                     <button 
                        onClick={() => onSelect(UserRole.STAFF)}
                        className="w-full group relative overflow-hidden bg-white dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 border-2 border-slate-100 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-700 p-5 rounded-2xl transition-all duration-300 flex items-center space-x-4 shadow-sm hover:shadow-md"
                     >
                         <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/50 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
                             <User className="w-6 h-6" />
                         </div>
                         <div className="text-left">
                             <h3 className="text-lg font-bold text-slate-800 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-300">Staff Portal</h3>
                             <p className="text-sm text-slate-500 dark:text-slate-400">Log daily activities & vitals</p>
                         </div>
                         <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity text-brand-400">
                             →
                         </div>
                     </button>

                     <button 
                        onClick={() => setShowAdminLogin(true)}
                        className="w-full group relative overflow-hidden bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-2 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 p-5 rounded-2xl transition-all duration-300 flex items-center space-x-4 shadow-sm hover:shadow-md"
                     >
                         <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:scale-110 transition-transform">
                             <Shield className="w-6 h-6" />
                         </div>
                         <div className="text-left">
                             <h3 className="text-lg font-bold text-slate-800 dark:text-white">Admin Console</h3>
                             <p className="text-sm text-slate-500 dark:text-slate-400">Manage residents & settings</p>
                         </div>
                     </button>
                </div>
            ) : (
                <form onSubmit={handleAdminAuth} className="space-y-6 animate-fade-in">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500 dark:text-slate-400">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Admin Access</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enter PIN to continue</p>
                    </div>

                    <div className="relative">
                        <input 
                            type="password" 
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value);
                                setError(false);
                            }}
                            className={`w-full text-center text-2xl tracking-[0.5em] font-bold py-4 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800 transition-all ${
                                error ? 'border-red-300 text-red-500' : 'border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:border-brand-500'
                            }`}
                            placeholder="••••"
                            maxLength={4}
                            autoFocus
                        />
                    </div>
                    
                    {error && <p className="text-center text-red-500 text-sm font-bold animate-bounce-slight">Incorrect PIN</p>}

                    <div className="flex space-x-3">
                        <button 
                            type="button" 
                            onClick={() => {
                                setShowAdminLogin(false);
                                setPin('');
                                setError(false);
                            }}
                            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Back
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-200 dark:shadow-none transition-transform transform active:scale-95"
                        >
                            Unlock
                        </button>
                    </div>
                </form>
            )}
            
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 font-medium">
               <span>v1.0.2 Stable</span>
               <div className="flex items-center space-x-1">
                 <Sparkles className="w-3 h-3" />
                 <span>Powered by Gemini AI</span>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check local storage or system preference
    if (localStorage.getItem('theme') === 'dark') return true;
    if (localStorage.getItem('theme') === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (isDarkMode) {
        root.classList.add('dark');
        body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        root.classList.remove('dark');
        body.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleLogout = () => {
    setUserRole(null);
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            !userRole ? (
              <LoginSelection onSelect={setUserRole} toggleTheme={toggleTheme} isDarkMode={isDarkMode} />
            ) : (
              <Navigate to={userRole === UserRole.ADMIN ? "/admin" : "/staff"} replace />
            )
          } 
        />
        
        <Route 
          path="/staff" 
          element={
            userRole === UserRole.STAFF || userRole === UserRole.ADMIN ? (
              <Layout role={UserRole.STAFF} onLogout={handleLogout} isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
                <StaffDashboard />
              </Layout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        <Route 
          path="/admin" 
          element={
            userRole === UserRole.ADMIN ? (
              <Layout role={UserRole.ADMIN} onLogout={handleLogout} isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
                <AdminDashboard />
              </Layout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
      </Routes>
    </Router>
  );
};

export default App;