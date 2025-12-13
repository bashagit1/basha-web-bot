import React, { useState, useEffect, useRef } from 'react';
import { DB } from '../services/database';
import { GeminiService } from '../services/geminiService';
import { Resident, UpdateCategory } from '../types';
import { 
  Camera, 
  Upload, 
  HeartPulse, 
  FileText, 
  Send, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Thermometer,
  AlertCircle,
  User,
  Coffee,
  Moon,
  Sun,
  Smile,
  ChevronDown,
  Layout
} from 'lucide-react';

const StaffDashboard: React.FC = () => {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [category, setCategory] = useState<UpdateCategory | null>(null);
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const topRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadResidents();
  }, []);

  useEffect(() => {
    if (category && formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [category]);

  const loadResidents = async () => {
    try {
      setErrorMessage(null);
      const data = await DB.getResidents();
      setResidents(data);
    } catch (err: any) {
      console.error("Failed to load residents", err);
      setErrorMessage(err.message || "Failed to load residents. Check connection.");
    }
  };

  // --- SMART IMAGE RESIZER (Mobile Optimized) ---
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        // use URL.createObjectURL for much faster loading on mobile devices
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            
            // OPTIMIZED: 500px max width. 
            // This is the "Sweet Spot" for Mobile-to-PC local transfer.
            // Small enough (~20KB) to send instantly, big enough for WhatsApp phone screens.
            const maxWidth = 500; 
            const scaleSize = maxWidth / img.width;
            const width = (img.width > maxWidth) ? maxWidth : img.width;
            const height = (img.width > maxWidth) ? img.height * scaleSize : img.height;

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Clean up memory immediately
            URL.revokeObjectURL(objectUrl);
            
            // JPEG at 0.3 quality. Extremely light.
            resolve(canvas.toDataURL('image/jpeg', 0.3));
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(""); // Skip broken images
        };

        img.src = objectUrl;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Limit images based on category
      const limit = category === UpdateCategory.VITALS ? 3 : 10; 
      if (images.length >= limit) {
         alert(`Maximum ${limit} image(s) allowed for this category.`);
         return;
      }

      try {
        // Resize immediately upon selection
        const resizedBase64 = await resizeImage(file);
        if (resizedBase64) {
            setImages(prev => [...prev, resizedBase64]);
        } else {
            alert("Failed to process image. Please try again.");
        }
      } catch (err) {
        console.error("Error processing image", err);
        alert("Could not process image. Try again.");
      }
    }
  };

  // --- COLLAGE ENGINE (UPDATED 1:1 GRID) ---
  const generateCollage = async (imageUrls: string[]): Promise<string> => {
    if (imageUrls.length <= 1) return imageUrls[0];

    // Load all images
    const loadedImages = await Promise.all(
      imageUrls.map(src => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }))
    );

    // Create a fixed 1:1 Square Canvas (1200x1200)
    // This ensures the image looks "Big" in WhatsApp preview
    const size = 1200;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error("Canvas context failed");

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const count = loadedImages.length;
    const gap = 8; // white gap size

    // Helper: Draw image nicely filling the rect (Object-Fit: Cover)
    const drawImg = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
        const imgRatio = img.width / img.height;
        const targetRatio = w / h;
        let sx, sy, sWidth, sHeight;
        
        if (targetRatio > imgRatio) { 
            // Target is wider than source -> Crop top/bottom
            sWidth = img.width;
            sHeight = img.width / targetRatio;
            sx = 0;
            sy = (img.height - sHeight) / 2;
        } else { 
            // Target is taller than source -> Crop sides
            sHeight = img.height;
            sWidth = img.height * targetRatio;
            sy = 0;
            sx = (img.width - sWidth) / 2;
        }
        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
    };

    if (count === 2) {
        // 2 Images: Split Vertically (Top and Bottom)
        // Keeps them wide and large
        const h = (size - gap) / 2;
        drawImg(loadedImages[0], 0, 0, size, h);
        drawImg(loadedImages[1], 0, h + gap, size, h);
    } else if (count === 3) {
        // 3 Images: 2 on Top, 1 on Bottom
        const half = (size - gap) / 2;
        
        // Top Left
        drawImg(loadedImages[0], 0, 0, half, half);
        // Top Right
        drawImg(loadedImages[1], half + gap, 0, half, half);
        // Bottom Full
        drawImg(loadedImages[2], 0, half + gap, size, half);
    } else {
        // 4+ Images: 2x2 Grid (for future proofing)
        const half = (size - gap) / 2;
        drawImg(loadedImages[0], 0, 0, half, half);
        drawImg(loadedImages[1], half + gap, 0, half, half);
        drawImg(loadedImages[2], 0, half + gap, half, half);
        drawImg(loadedImages[3], half + gap, half + gap, half, half);
    }

    // High quality export
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleSubmit = async () => {
    if (!selectedResidentId || !category) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    
    const resident = residents.find(r => r.id === selectedResidentId);
    
    try {
        // Run AI generation and Image Processing in PARALLEL to save time
        const aiPromise = GeminiService.generateMessage(
            resident?.name || 'Resident',
            category,
            notes
        );

        let imagePromise: Promise<string[]> = Promise.resolve(images);
        
        // Only collage if Vitals and > 1 image
        if (category === UpdateCategory.VITALS && images.length > 1) {
            imagePromise = generateCollage(images).then(collage => [collage]).catch(e => {
                console.error("Collage failed, sending individual", e);
                return images;
            });
        }

        // Wait for both to finish
        const [aiMessage, finalImages] = await Promise.all([aiPromise, imagePromise]);

        await DB.createLog({
            residentId: selectedResidentId,
            residentName: resident?.name || 'Unknown',
            staffName: 'Jane Doe', // Hardcoded for demo
            category: category,
            notes: notes,
            imageUrls: finalImages,
            aiGeneratedMessage: aiMessage
        });
        
        setSubmitStatus('success');
        
        if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth' });

        setTimeout(() => {
            setSubmitStatus('idle');
            setCategory(null);
            setNotes('');
            setImages([]);
            setSelectedResidentId('');
        }, 3000);

    } catch (error: any) {
        console.error(error);
        setSubmitStatus('error');
        setErrorMessage(error.message || "Failed to send update.");
    } finally {
        setIsSubmitting(false);
    }
  };

  // Define categories with Dark Mode specific styles (bg-opacity for glowing effect)
  const categories = [
    { 
        id: UpdateCategory.BREAKFAST, 
        icon: <Coffee className="w-8 h-8" />, 
        label: 'Breakfast', 
        // Light Mode
        bg: 'bg-amber-100', 
        text: 'text-amber-600', 
        border: 'border-amber-200', 
        ring: 'focus:ring-amber-400',
        // Dark Mode Overrides
        darkBg: 'dark:bg-amber-900/30',
        darkText: 'dark:text-amber-400',
        darkBorder: 'dark:border-amber-800'
    },
    { 
        id: UpdateCategory.LUNCH, 
        icon: <Sun className="w-8 h-8" />, 
        label: 'Lunch', 
        bg: 'bg-orange-100', 
        text: 'text-orange-600', 
        border: 'border-orange-200', 
        ring: 'focus:ring-orange-400',
        darkBg: 'dark:bg-orange-900/30',
        darkText: 'dark:text-orange-400',
        darkBorder: 'dark:border-orange-800'
    },
    { 
        id: UpdateCategory.TEA_TIME, 
        icon: <Coffee className="w-8 h-8" />, 
        label: 'Tea Time', 
        bg: 'bg-teal-100', 
        text: 'text-teal-600', 
        border: 'border-teal-200', 
        ring: 'focus:ring-teal-400',
        darkBg: 'dark:bg-teal-900/30',
        darkText: 'dark:text-teal-400',
        darkBorder: 'dark:border-teal-800'
    },
    { 
        id: UpdateCategory.DINNER, 
        icon: <Moon className="w-8 h-8" />, 
        label: 'Dinner', 
        bg: 'bg-indigo-100', 
        text: 'text-indigo-600', 
        border: 'border-indigo-200', 
        ring: 'focus:ring-indigo-400',
        darkBg: 'dark:bg-indigo-900/30',
        darkText: 'dark:text-indigo-400',
        darkBorder: 'dark:border-indigo-800'
    },
    { 
        id: UpdateCategory.VITALS, 
        icon: <HeartPulse className="w-8 h-8" />, 
        label: 'Vitals', 
        bg: 'bg-rose-100', 
        text: 'text-rose-600', 
        border: 'border-rose-200', 
        ring: 'focus:ring-rose-400',
        darkBg: 'dark:bg-rose-900/30',
        darkText: 'dark:text-rose-400',
        darkBorder: 'dark:border-rose-800'
    },
    { 
        id: UpdateCategory.GLUCOSE, 
        icon: <Thermometer className="w-8 h-8" />, 
        label: 'Glucose', 
        bg: 'bg-blue-100', 
        text: 'text-blue-600', 
        border: 'border-blue-200', 
        ring: 'focus:ring-blue-400',
        darkBg: 'dark:bg-blue-900/30',
        darkText: 'dark:text-blue-400',
        darkBorder: 'dark:border-blue-800'
    },
    { 
        id: UpdateCategory.GENERAL, 
        icon: <Smile className="w-8 h-8" />, 
        label: 'General', 
        bg: 'bg-emerald-100', 
        text: 'text-emerald-600', 
        border: 'border-emerald-200', 
        ring: 'focus:ring-emerald-400',
        darkBg: 'dark:bg-emerald-900/30',
        darkText: 'dark:text-emerald-400',
        darkBorder: 'dark:border-emerald-800'
    },
  ];

  const selectedResident = residents.find(r => r.id === selectedResidentId);
  const activeCategoryDef = categories.find(c => c.id === category);

  if (submitStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-green-200 dark:bg-green-900/50 rounded-full blur-xl opacity-50 animate-pulse"></div>
          <div className="relative w-24 h-24 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6 shadow-lg border-4 border-white dark:border-slate-800">
            <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Lovely! Update Sent.</h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xs mx-auto">The family has been notified on WhatsApp.</p>
        <button 
          onClick={() => setSubmitStatus('idle')} 
          className="mt-8 px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Send Another
        </button>
      </div>
    );
  }

  return (
    <div ref={topRef} className="max-w-2xl mx-auto pb-28 space-y-8">
      
      {/* Welcome Header */}
      <header className="flex flex-col items-start">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Hello, Staff Member 👋</h1>
        <p className="text-slate-500 dark:text-slate-400">Ready to share some updates?</p>
      </header>

      {/* Error Message Display */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 rounded-r-lg flex items-start space-x-3 text-red-800 dark:text-red-300 shadow-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-sm">Something went wrong</h3>
            <p className="text-sm mt-1 opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Resident Selection Card */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-1 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <div className="relative">
           <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              {selectedResident ? (
                <img 
                   src={selectedResident.photoUrl || `https://ui-avatars.com/api/?name=${selectedResident.name}&background=random`} 
                   className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm" 
                   alt="" 
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
                   <User className="w-6 h-6" />
                </div>
              )}
           </div>
           <select
            value={selectedResidentId}
            onChange={(e) => {
                setSelectedResidentId(e.target.value);
                setCategory(null);
            }}
            className="w-full pl-16 pr-10 py-5 bg-transparent rounded-3xl text-lg font-semibold text-slate-700 dark:text-white focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900 focus:bg-brand-50/50 dark:focus:bg-brand-900/10 outline-none cursor-pointer appearance-none transition-all"
          >
            <option value="" className="dark:bg-slate-800">Select a Resident...</option>
            {residents.map(r => (
              <option key={r.id} value={r.id} className="dark:bg-slate-800">{r.name} (Rm {r.roomNumber})</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none text-slate-400">
             <ChevronDown className="w-5 h-5" />
          </div>
        </div>
      </section>

      {selectedResidentId && (
        <>
          {/* Category Grid */}
          <section className="animate-fade-in-up">
            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 ml-2">What's happening?</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`relative group p-4 rounded-3xl border transition-all duration-300 flex flex-col items-center justify-center gap-3 hover:-translate-y-1 hover:shadow-lg ${
                    category === cat.id 
                      ? `${cat.bg} ${cat.darkBg} ${cat.border} ${cat.darkBorder} ring-4 ring-offset-2 ring-brand-100 dark:ring-brand-900 dark:ring-offset-slate-900 shadow-md scale-105 z-10` 
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 shadow-sm'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                      category === cat.id ? 'bg-white/60 dark:bg-black/20' : `${cat.bg} ${cat.darkBg}`
                  } ${cat.text} ${cat.darkText}`}>
                     {cat.icon}
                  </div>
                  <span className={`font-bold text-sm ${category === cat.id ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                      {cat.label}
                  </span>
                  
                  {/* Active Indicator */}
                  {category === cat.id && (
                    <div className="absolute -top-2 -right-2 bg-brand-500 text-white p-1 rounded-full shadow-sm">
                        <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {category && activeCategoryDef && (
            <div ref={formRef} className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl shadow-slate-200/60 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up transition-colors">
               {/* Form Header */}
               <div className="bg-slate-50/80 dark:bg-slate-900/50 p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                     <div className={`p-2 rounded-lg ${activeCategoryDef.bg} ${activeCategoryDef.darkBg} ${activeCategoryDef.text} ${activeCategoryDef.darkText}`}>
                         {activeCategoryDef.icon}
                     </div>
                     <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">{activeCategoryDef.label} Update</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Logging for {selectedResident?.name}</p>
                     </div>
                  </div>
               </div>

               <div className="p-6 space-y-8">
                  {/* Media Upload */}
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Capture the Moment</span>
                        {category === UpdateCategory.VITALS && images.length > 1 && (
                            <span className="text-xs text-brand-500 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-full flex items-center gap-1">
                                <Layout className="w-3 h-3" />
                                Collage Enabled
                            </span>
                        )}
                    </label>
                    
                    <div className="flex flex-wrap gap-4">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative w-28 h-28 rounded-2xl overflow-hidden border-4 border-white dark:border-slate-700 shadow-md rotate-1 hover:rotate-0 transition-transform">
                          <img src={img} alt="Upload preview" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setImages(images.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full backdrop-blur-sm transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {images.length < (category === UpdateCategory.VITALS ? 3 : 10) && (
                        <div className="flex gap-3">
                            <label className="w-28 h-28 flex flex-col items-center justify-center border-2 border-dashed border-brand-300 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-900/10 text-brand-600 dark:text-brand-400 rounded-2xl cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/20 hover:border-brand-400 transition-all group">
                                <Camera className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold">Camera</span>
                                <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={handleImageUpload}
                                />
                            </label>
                            <label className="w-28 h-28 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 transition-all group">
                                <Upload className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold">Upload</span>
                                <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleImageUpload}
                                />
                            </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Add a Note (Optional)</label>
                    <div className="relative group">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="E.g. Ate well, high spirits..."
                        className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none min-h-[120px] transition-all resize-none group-hover:bg-white dark:group-hover:bg-slate-900 dark:text-white dark:placeholder-slate-500"
                      />
                      <div className="absolute bottom-3 right-3 text-slate-300 dark:text-slate-600 pointer-events-none">
                         <FileText className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
               </div>

               {/* Action Bar */}
               <div className="p-6 pt-0">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`w-full py-4 px-6 rounded-2xl text-white font-bold text-lg shadow-lg shadow-brand-200 dark:shadow-none flex items-center justify-center space-x-3 transition-all transform active:scale-95 ${
                    isSubmitting ? 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>
                          {category === UpdateCategory.VITALS && images.length > 1 ? 'Stitching & Sending...' : 'Sending...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Send Update</span>
                      <Send className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StaffDashboard;