/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Sliders, Database, Users, History, Trash2, Edit2, Check, X, Plus, 
  Search, Printer, Download, Upload, RefreshCw, Save, AlertTriangle, FileUp, Sparkles, Filter
} from 'lucide-react';
import { LIQ_SEED_CLIENTES as seedClientes, LIQ_SEED_CATALOG as seedCatalog } from '../data/liquidadorSeed';
import { saveToCloud, subscribeToCloud } from '../firebaseService';

// Safe LocalStorage proxy to prevent SecurityErrors in sandboxed environments
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (e) {
      console.warn(`[Storage] localStorage is unavailable (key: ${key}):`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[Storage] localStorage set failed (key: ${key}):`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[Storage] localStorage remove failed (key: ${key}):`, e);
    }
  }
};

const localStorage = safeLocalStorage;

export default function LiquidadorModule() {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<'liquidacion' | 'catalogo' | 'clientes' | 'historial'>('liquidacion');

  // Database collections (persisted in localStorage under separate keys to isolate from main ERP)
  const [catalog, setCatalog] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Record<string, any>>({});
  const [historial, setHistorial] = useState<any[]>([]);

  // Current PV form inputs
  const [clienteActual, setClienteActual] = useState('');
  const [sucursalActual, setSucursalActual] = useState('');
  const [pvNum, setPvNum] = useState('');
  const [pvFecha, setPvFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [pvOc, setPvOc] = useState('');
  const [pdfStatus, setPdfStatus] = useState('');
  const [pdfRefFound, setPdfRefFound] = useState<number | null>(null);

  // active billing state
  const [pedido, setPedido] = useState<Record<string, number>>({}); // cod -> cajas
  const [preciosPV, setPreciosPV] = useState<Record<string, number>>({}); // cod -> precio
  const [selectedProductIndex, setSelectedProductIndex] = useState<Record<string, number>>({}); // cod -> original index in catalog
  const [verSoloPV, setVerSoloPV] = useState(false);

  // Administrative inline editing states (Catalog)
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [editingCatalogIdx, setEditingCatalogIdx] = useState<number | null>(null);
  const [catalogPage, setCatalogPage] = useState(1);
  const catalogItemsPerPage = 12;

  // New catalog item forms
  const [newCatalogCod, setNewCatalogCod] = useState('');
  const [newCatalogRef, setNewCatalogRef] = useState('');
  const [newCatalogMarca, setNewCatalogMarca] = useState('');
  const [newCatalogUnd, setNewCatalogUnd] = useState(24);
  const [newCatalogPrecio, setNewCatalogPrecio] = useState(0);
  const [newCatalogPeso, setNewCatalogPeso] = useState(0);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Administrative inline editing states (Clientes)
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [searchClientDropdownQuery, setSearchClientDropdownQuery] = useState('');
  const [editingClientKey, setEditingClientKey] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientSucursales, setEditClientSucursales] = useState('');
  const [editClientMarcas, setEditClientMarcas] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Historial pagination
  const [historialPage, setHistorialPage] = useState(1);
  const historyItemsPerPage = 10;

  // Toast / System updates
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Custom confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // PDF.js worker availability tracker
  const [isPdfLibLoading, setIsPdfLibLoading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);

  // Loop locks for Firestore array and record states
  const lastSavedCatalog = useRef<string>('');
  const lastSavedLiqClientes = useRef<string>('');
  const lastSavedHistorial = useRef<string>('');

  // Save changes to local storage and Firestore when state changes
  useEffect(() => {
    const raw = JSON.stringify(catalog);
    if (raw && raw !== lastSavedCatalog.current) {
      lastSavedCatalog.current = raw;
      localStorage.setItem('liq_catalog', raw);
      saveToCloud('liq_state', 'catalog', catalog);
    }
  }, [catalog]);

  useEffect(() => {
    const raw = JSON.stringify(clientes);
    if (raw && raw !== lastSavedLiqClientes.current) {
      lastSavedLiqClientes.current = raw;
      localStorage.setItem('liq_clientes', raw);
      saveToCloud('liq_state', 'clientes', clientes);
    }
  }, [clientes]);

  useEffect(() => {
    const raw = JSON.stringify(historial);
    if (raw && raw !== lastSavedHistorial.current) {
      lastSavedHistorial.current = raw;
      localStorage.setItem('liq_historial', raw);
      saveToCloud('liq_state', 'historial', historial);
    }
  }, [historial]);

  // Initialize and load catalogs on mount
  useEffect(() => {
    // 1. Local storage or seed fallback loaded instantly
    const savedCat = localStorage.getItem('liq_catalog');
    if (savedCat) {
      setCatalog(JSON.parse(savedCat));
    } else {
      setCatalog(seedCatalog);
      localStorage.setItem('liq_catalog', JSON.stringify(seedCatalog));
    }

    const savedCli = localStorage.getItem('liq_clientes');
    if (savedCli) {
      setClientes(JSON.parse(savedCli));
    } else {
      setClientes(seedClientes);
      localStorage.setItem('liq_clientes', JSON.stringify(seedClientes));
    }

    const savedHist = localStorage.getItem('liq_historial');
    if (savedHist) {
      setHistorial(JSON.parse(savedHist));
    }

    // 2. Subscribe to live Firestore state updates
    const unsubCatalog = subscribeToCloud('liq_state', 'catalog', (data) => {
      if (Array.isArray(data)) {
        const raw = JSON.stringify(data);
        lastSavedCatalog.current = raw;
        setCatalog(data);
        localStorage.setItem('liq_catalog', raw);
      }
    });

    const unsubClientes = subscribeToCloud('liq_state', 'clientes', (data) => {
      if (data && typeof data === 'object') {
        const raw = JSON.stringify(data);
        lastSavedLiqClientes.current = raw;
        setClientes(data);
        localStorage.setItem('liq_clientes', raw);
      }
    });

    const unsubHistorial = subscribeToCloud('liq_state', 'historial', (data) => {
      if (Array.isArray(data)) {
        const raw = JSON.stringify(data);
        lastSavedHistorial.current = raw;
        setHistorial(data);
        localStorage.setItem('liq_historial', raw);
      }
    });

    // Dynamic Script Injection for pdf.js if not present
    if (!(window as any).pdfjsLib) {
      setIsPdfLibLoading(true);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.async = true;
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        setIsPdfLibLoading(false);
      };
      script.onerror = () => {
        setIsPdfLibLoading(false);
        showToast('error', 'Error al cargar módulo de pdf.js');
      };
      document.head.appendChild(script);
    }

    return () => {
      unsubCatalog();
      unsubClientes();
      unsubHistorial();
    };
  }, []);

  // Show interactive notifications
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper formats
  const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
  const fmtD = (n: number) => n.toFixed(2);

  // Computed properties
  const filteredProductsByCliente = useMemo(() => {
    if (!clienteActual || !clientes[clienteActual]) return [];
    const clientInfo = clientes[clienteActual] as any;
    const marcasCliente = clientInfo?.marcas || [];
    if (marcasCliente.length === 0) {
      return catalog;
    }
    const cleanStr = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return catalog.filter(p => marcasCliente.some((m: string) => cleanStr(m) === cleanStr(p.marca)));
  }, [clienteActual, catalog, clientes]);

  const groupedProductsByCode = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredProductsByCliente.forEach((p, originalIndexInCatalog) => {
      // Keep track of original index in complete catalog to map correctly
      const itemWithMeta = { ...p, originalIndex: originalIndexInCatalog };
      if (!grouped[p.cod]) {
        grouped[p.cod] = [itemWithMeta];
      } else {
        grouped[p.cod].push(itemWithMeta);
      }
    });
    return grouped;
  }, [filteredProductsByCliente]);

  // Totals calculations
  const totals = useMemo(() => {
    let rawCajas = 0;
    let rawUnds = 0;
    let rawPeso = 0;
    let rawSubtotal = 0;

    Object.entries(pedido).forEach(([cod, cajasVal]) => {
      const cajas = cajasVal as number;
      if (cajas <= 0) return;
      
      // Get the correct selected item matching duplicates selection
      let product = null;
      const selectedIndex = selectedProductIndex[cod];
      if (selectedIndex !== undefined) {
        product = catalog[selectedIndex];
      } else {
        // Find first occurrence
        product = catalog.find(p => p.cod === cod);
      }

      if (!product) return;
      rawCajas += cajas;
      const units = cajas * product.und;
      rawUnds += units;
      rawPeso += cajas * product.peso;
      const finalPrice = preciosPV[cod] !== undefined ? preciosPV[cod] : product.precio;
      rawSubtotal += units * finalPrice;
    });

    return {
      cajas: rawCajas,
      unidades: rawUnds,
      peso: rawPeso,
      subtotal: rawSubtotal,
    };
  }, [pedido, catalog, preciosPV, selectedProductIndex]);


  // PDF Selection handler (triggered when a file is chosen)
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPdfFile(file);
      setPdfStatus(`Listo para procesar: ${file.name}`);
      showToast('success', `Archivo "${file.name}" cargado. Presiona el botón "PROCESAR Y CARGAR PV" para consolidar.`);
    }
  };

  // PDF Parser Executor (manually triggered via the CARGAR PV button)
  const handleExecutePdfLoad = async () => {
    if (!selectedPdfFile) {
      showToast('error', 'Por favor, selecciona primero un archivo PDF.');
      return;
    }
    
    setPdfStatus('Leyendo archivo...');
    setPdfRefFound(null);

    const fileReader = new FileReader();
    fileReader.onerror = () => {
      setPdfStatus('');
      showToast('error', 'Error al leer el archivo PDF');
    };

    fileReader.onload = async function() {
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          setPdfStatus('');
          showToast('error', 'El lector PDF aún no está listo. Intenta de nuevo en unos segundos.');
          return;
        }

        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str).join(' ');
          fullText += ' ' + strings;
        }

        const normalizedText = fullText.replace(/\s+/g, ' ');

        // Try to identify Client automatically
        let matchedClient = '';
        for (const clientName of Object.keys(clientes)) {
          if (normalizedText.toUpperCase().includes(clientName.toUpperCase())) {
            matchedClient = clientName;
            break;
          }
        }

        const finalClient = matchedClient || clienteActual;

        if (finalClient) {
          setClienteActual(finalClient);
          showToast('success', matchedClient ? `Cliente detectado: ${matchedClient}` : `Usando el cliente seleccionado: ${finalClient}`);
          
          // Try to identify sucursal/branch automatically
          let matchedSucursal = sucursalActual;
          const clientBranches = (clientes[finalClient] as any)?.sucursales || [];
          for (const s of clientBranches) {
            if (normalizedText.toUpperCase().includes(s.toUpperCase())) {
              matchedSucursal = s;
              break;
            }
          }
          if (!matchedSucursal && normalizedText.toUpperCase().includes('PRINCIPAL')) {
            const principal = clientBranches.find((x: string) => x.toUpperCase().includes('PRINCIPAL'));
            if (principal) matchedSucursal = principal;
          }
          if (matchedSucursal) {
            setSucursalActual(matchedSucursal);
          } else if (clientBranches.length > 0 && !sucursalActual) {
            setSucursalActual(clientBranches[0]);
          }
        } else {
          showToast('error', 'No se pudo identificar el cliente del PDF. Por favor selecciónalo manualmente en la parte superior antes de cargar.');
        }

        // Search for PV Number & OC code in text
        const pvMatch = normalizedText.match(/PV\s*(\d+)/i) || normalizedText.match(/Pedido\s*(?:de\s*Venta)?\s*N°?\s*(\d+)/i) || normalizedText.match(/N(?:o|º|°|úm\.?)\s*PV\s*(\d+)/i);
        if (pvMatch) {
          setPvNum('PV ' + pvMatch[1]);
        }
        
        const ocMatch = normalizedText.match(/OC[A-Z0-9-]*\d+/i) || normalizedText.match(/Orden\s*(?:de\s*Compra)?\s*(?:N°?)?\s*([A-Za-z0-9-]+)/i);
        if (ocMatch) {
          setPvOc(ocMatch[1] || ocMatch[0]);
        }

        // Initialize temporary structures for mapped order
        const newPedido: Record<string, number> = {};
        const newPrices: Record<string, number> = {};
        const newSelectedProdIndex: Record<string, number> = {};
        let countRef = 0;

        // Fetch products matching parsed client's brands, grouped by code
        const targetCatalogByCode: Record<string, any[]> = {};
        let scanList: any[] = [];

        if (finalClient) {
          const clientInfo = clientes[finalClient] as any;
          const brands = clientInfo?.marcas || [];
          if (brands.length === 0) {
            scanList = catalog.map((p, idx) => ({ ...p, originalIndex: idx }));
          } else {
            const cleanStr = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            scanList = catalog.map((p, idx) => ({ ...p, originalIndex: idx }))
                              .filter(p => brands.some((b: string) => cleanStr(b) === cleanStr(p.marca)));
          }
        } else {
          scanList = catalog.map((p, idx) => ({ ...p, originalIndex: idx }));
        }

        scanList.forEach(p => {
          if (!targetCatalogByCode[p.cod]) targetCatalogByCode[p.cod] = [];
          targetCatalogByCode[p.cod].push(p);
        });

        // Fallback para códigos no cubiertos por las marcas del cliente
        catalog.forEach((p, idx) => {
          if (!targetCatalogByCode[p.cod]) {
            targetCatalogByCode[p.cod] = [{ ...p, originalIndex: idx }];
          }
        });

        // Loop over target codes to parse amounts from text
        Object.keys(targetCatalogByCode).forEach(cod => {
          const items = targetCatalogByCode[cod];
          const standardPrice = items[0].precio;
          const standardUnd = items[0].und;

          // Try both full code (e.g., "01050461") and trimmed numeric code (e.g., "1050461")
          const codStrVariants = [cod, parseInt(cod, 10).toString()];
          let foundMatch = false;

          for (const variant of codStrVariants) {
            if (foundMatch) break;

            // Pattern 1: Standard with $ sign: code + (descript) + qty + $ + price
            const regex1 = new RegExp(
              variant + "\\s+([^$]{1,150}?)\\s+([\\d,]+(?:\\.\\d+)?)\\s*\\$\\s*([\\d,]+(?:\\.\\d+)?)", "i"
            );
            // Pattern 2: Without $ sign: code + (descript) + qty + price at the end
            const regex2 = new RegExp(
              variant + "\\s+([^0-9]{1,150}?)\\s+([\\d,]{1,10}(?:\\.\\d{1,2})?)\\s+([\\d,]{3,12}(?:\\.\\d{1,2})?)", "i"
            );
            // Pattern 3: Simple sequential columns: code + qty + price directly
            const regex3 = new RegExp(
              variant + "\\s+([\\d,]+(?:\\.\\d+)?)\\s+([\\d,]+(?:\\.\\d+)?)", "i"
            );

            const patterns = [regex1, regex2, regex3];
            for (const pat of patterns) {
              const match = normalizedText.match(pat);
              if (match) {
                let qtyStr = match[2];
                let priceStr = match[3];

                if (!priceStr && match[1]) {
                  qtyStr = match[1];
                  priceStr = match[2];
                }

                qtyStr = qtyStr.replace(/,/g, "");
                priceStr = priceStr.replace(/,/g, "");

                const units = parseFloat(qtyStr);
                const price = parseFloat(priceStr);

                if (!isNaN(units) && units > 0 && !isNaN(price) && price > 0) {
                  let bestProduct = items[0];
                  let minDiff = Infinity;
                  
                  items.forEach(item => {
                    const diff = Math.abs(item.precio - price);
                    if (diff < minDiff) {
                      minDiff = diff;
                      bestProduct = item;
                    }
                  });

                  newSelectedProdIndex[cod] = bestProduct.originalIndex;
                  newPedido[cod] = units / bestProduct.und;
                  newPrices[cod] = price;
                  countRef++;
                  foundMatch = true;
                  break;
                }
              }
            }

            // Heuristic close-proximity backup scanner if regular regex matches failed
            if (!foundMatch) {
              const codIndex = normalizedText.indexOf(variant);
              if (codIndex !== -1) {
                const rangeText = normalizedText.substring(codIndex + variant.length, codIndex + variant.length + 200);
                // Look for sequence of numbers
                const numberMatches = rangeText.match(/[\d,.]+/g) || [];
                const numbers = numberMatches.map(m => {
                  let cleanNum = m;
                  const hasComma = m.includes(',');
                  const hasDot = m.includes('.');
                  if (hasComma && hasDot) {
                    if (m.indexOf(',') < m.indexOf('.')) {
                      cleanNum = m.replace(/,/g, '');
                    } else {
                      cleanNum = m.replace(/\./g, '').replace(/,/g, '.');
                    }
                  } else if (hasComma) {
                    if (m.split(',')[1]?.length <= 2) {
                      cleanNum = m.replace(/,/g, '.');
                    } else {
                      cleanNum = m.replace(/,/g, '');
                    }
                  } else if (hasDot) {
                    const splitVal = m.split('.');
                    if (splitVal[1]?.length === 3) {
                      const valAsDecimal = parseFloat(m);
                      const valWithoutDot = parseFloat(m.replace(/\./g, ''));
                      if (Math.abs(valWithoutDot - standardPrice) < Math.abs(valAsDecimal - standardPrice)) {
                        cleanNum = m.replace(/\./g, '');
                      }
                    }
                  }
                  return parseFloat(cleanNum);
                }).filter(n => !isNaN(n) && n > 0 && n !== standardUnd);

                if (numbers.length >= 2) {
                  let foundPrice = 0;
                  let foundPriceIdx = -1;
                  let minPriceDiff = Infinity;

                  // Find the number closest to the catalog price
                  numbers.forEach((num, idx) => {
                    const priceDiff = Math.abs(num - standardPrice) / standardPrice;
                    if (priceDiff < 0.6 && priceDiff < minPriceDiff) {
                      minPriceDiff = priceDiff;
                      foundPrice = num;
                      foundPriceIdx = idx;
                    }
                  });

                  // If not identified by matching standard price, default to selecting the closest one
                  if (foundPriceIdx === -1) {
                    let bestPriceIdx = -1;
                    let bestPriceDiff = Infinity;
                    numbers.forEach((num, idx) => {
                      const diff = Math.abs(num - standardPrice);
                      if (diff < bestPriceDiff) {
                        bestPriceDiff = diff;
                        bestPriceIdx = idx;
                      }
                    });
                    if (bestPriceIdx !== -1) {
                      foundPrice = numbers[bestPriceIdx];
                      foundPriceIdx = bestPriceIdx;
                    }
                  }

                  if (foundPriceIdx !== -1) {
                    let qtyIndex = -1;
                    for (let i = 0; i < numbers.length; i++) {
                      if (i !== foundPriceIdx) {
                        qtyIndex = i;
                        break;
                      }
                    }

                    if (qtyIndex !== -1) {
                      const units = numbers[qtyIndex];
                      const price = foundPrice;

                      let bestProduct = items[0];
                      let minDiff = Infinity;
                      items.forEach(item => {
                        const diff = Math.abs(item.precio - price);
                        if (diff < minDiff) {
                          minDiff = diff;
                          bestProduct = item;
                        }
                      });

                      newSelectedProdIndex[cod] = bestProduct.originalIndex;
                      newPedido[cod] = units / bestProduct.und;
                      newPrices[cod] = price;
                      countRef++;
                      foundMatch = true;
                    }
                  }
                }
              }
            }
          }
        });

        setPedido(newPedido);
        setPreciosPV(newPrices);
        setSelectedProductIndex(prev => ({ ...prev, ...newSelectedProdIndex }));
        setPdfRefFound(countRef);
        setPdfStatus('PDF procesado exitosamente.');
        showToast('success', `PDF procesado: Se cargaron ${countRef} referencias.`);

      } catch (err) {
        console.error(err);
        setPdfStatus('');
        showToast('error', 'Error al procesar el archivo PDF');
      }
    };

    fileReader.readAsArrayBuffer(selectedPdfFile);
  };

  // Pre-fill fallback demo helper
  const handlePreFillDemo = () => {
    if (!clienteActual) {
      setClienteActual("SUPERMERCADO LA VAQUITA BELLO");
      setSucursalActual("BELLO PRINCIPAL");
    }
    setPvNum("PV 2070");
    setPvOc("OC-COE-00000081");
    
    // Set quantities according to the user's legacy seed
    const mockPedido = {
      "01050461": 111.11,
      "01050715": 222.22,
      "01060349": 83.33,
      "01200004": 18,
      "01200005": 177.78
    };

    // Ensure selected productive indexes are set correctly of duplicates
    const mockSelectedProdIndex: Record<string, number> = {};
    Object.keys(mockPedido).forEach(cod => {
      const idx = catalog.findIndex(p => p.cod === cod);
      if (idx !== -1) mockSelectedProdIndex[cod] = idx;
    });

    setPedido(mockPedido);
    setSelectedProductIndex(mockSelectedProdIndex);
    showToast('success', 'Formulario rellenado con datos de demo (PV 2070) exitosamente!');
  };

  const handleUpdateProductQty = (cod: string, rawVal: string, type: 'cajas' | 'unidades') => {
    const val = parseFloat(rawVal) || 0;
    if (val < 0) return;

    // Get selected layout element to map properties
    let p = null;
    const activeIndex = selectedProductIndex[cod];
    if (activeIndex !== undefined) {
      p = catalog[activeIndex];
    } else {
      p = catalog.find(item => item.cod === cod);
    }

    if (!p) return;

    setPedido(prev => {
      const copy = { ...prev };
      if (type === 'cajas') {
        if (val === 0) {
          delete copy[cod];
        } else {
          copy[cod] = val;
        }
      } else {
        const calculatedCajas = val / p.und;
        if (calculatedCajas === 0) {
          delete copy[cod];
        } else {
          copy[cod] = calculatedCajas;
        }
      }
      return copy;
    });
  };

  // Clear current loadout
  const handleClearBilling = () => {
    setPedido({});
    setPreciosPV({});
    setSelectedProductIndex({});
    setPvNum('');
    setPvOc('');
    setPdfStatus('');
    setPdfRefFound(null);
    showToast('success', 'Liquidación reiniciada.');
  };

  // Save bill into local history
  const handleSavePV = () => {
    if (!clienteActual || !sucursalActual) {
      showToast('error', 'Selecciona el cliente y sucursal antes de guardar.');
      return;
    }
    if (!pvNum.trim()) {
      showToast('error', 'Ingresa el número de pedido/PV antes de guardar.');
      return;
    }

    const newPvItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString('es-CO'),
      numPV: pvNum,
      fecha: pvFecha,
      oc: pvOc,
      cliente: clienteActual,
      sucursal: sucursalActual,
      pedido,
      preciosPV,
      selectedProductIndex,
      subtotal: totals.subtotal
    };

    setHistorial(prev => {
      const updated = [newPvItem, ...prev];
      localStorage.setItem('liq_historial', JSON.stringify(updated));
      return updated;
    });

    showToast('success', `Pedido ${pvNum} de ${clienteActual} guardado exitosamente.`);
  };

  // Load a saved PV from history
  const handleLoadPVFromHistory = (item: any) => {
    setPvNum(item.numPV || '');
    setPvFecha(item.fecha || '');
    setPvOc(item.oc || '');
    setClienteActual(item.cliente || '');
    setSucursalActual(item.sucursal || '');
    setPedido(item.pedido || {});
    setPreciosPV(item.preciosPV || {});
    setSelectedProductIndex(item.selectedProductIndex || {});
    
    // Navigate home to billing screen
    setActiveSubTab('liquidacion');
    showToast('success', `Cargado PV ${item.numPV} de ${item.cliente}`);
  };

  // Delete a saved PV from history
  const handleDeletePVFromHistory = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'ELIMINAR LIQUIDACIÓN',
      message: '¿Estás seguro de que deseas eliminar este registro de liquidación en el historial local? Esta acción no se puede deshacer.',
      onConfirm: () => {
        setHistorial(prev => {
          const filtered = prev.filter(item => item.id !== id);
          localStorage.setItem('liq_historial', JSON.stringify(filtered));
          return filtered;
        });
        showToast('success', 'Registro eliminado del historial');
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Download raw database to backup
  const handleDownloadDatabaseBackup = () => {
    const backupObj = {
      catalog,
      clientes,
      historial
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Liquidador_Resumen_Completo_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Copia de seguridad descargada.');
  };

  // Upload database from backup
  const handleUploadDatabaseBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.catalog && data.clientes) {
          setCatalog(data.catalog);
          localStorage.setItem('liq_catalog', JSON.stringify(data.catalog));
          
          setClientes(data.clientes);
          localStorage.setItem('liq_clientes', JSON.stringify(data.clientes));
          
          if (data.historial) {
            setHistorial(data.historial);
            localStorage.setItem('liq_historial', JSON.stringify(data.historial));
          }
          showToast('success', 'Base de datos restaurada correctamente');
        } else {
          showToast('error', 'El archivo no contiene un formato de respaldo válido');
        }
      } catch (err) {
        showToast('error', 'Error al leer o parsear el archivo JSON de respaldo');
      }
    };
    reader.readAsText(file);
  };

  // Direct print option
  const handlePrintView = () => {
     window.print();
  };

  // --- CATALOG MANAGEMENT ADMIN METHODS ---
  const filteredCatalogForAdmin = useMemo(() => {
    return catalog.filter(p => {
      if (!searchCatalogQuery) return true;
      const q = searchCatalogQuery.toLowerCase().trim();
      return p.cod.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q);
    });
  }, [catalog, searchCatalogQuery]);

  const totalCatalogPages = Math.ceil(filteredCatalogForAdmin.length / catalogItemsPerPage) || 1;
  const paginatedCatalogForAdmin = useMemo(() => {
    const start = (catalogPage - 1) * catalogItemsPerPage;
    return filteredCatalogForAdmin.slice(start, start + catalogItemsPerPage);
  }, [filteredCatalogForAdmin, catalogPage]);

  const handleSaveCatalogEdit = (idxInFilter: number) => {
    // We need to resolve standard index in complete catalog list
    const itemInFilter = paginatedCatalogForAdmin[idxInFilter];
    const originalIndex = catalog.findIndex(p => p.cod === itemInFilter.cod && p.ref === itemInFilter.ref);
    if (originalIndex === -1) return;

    const editedCod = (document.getElementById(`edit-cod-${idxInFilter}`) as HTMLInputElement)?.value.trim();
    const editedRef = (document.getElementById(`edit-ref-${idxInFilter}`) as HTMLInputElement)?.value.trim();
    const editedMarca = (document.getElementById(`edit-marca-${idxInFilter}`) as HTMLInputElement)?.value.trim();
    const editedUnd = parseInt((document.getElementById(`edit-und-${idxInFilter}`) as HTMLInputElement)?.value) || 24;
    const editedPrecio = parseFloat((document.getElementById(`edit-precio-${idxInFilter}`) as HTMLInputElement)?.value) || 0;
    const editedPeso = parseFloat((document.getElementById(`edit-peso-${idxInFilter}`) as HTMLInputElement)?.value) || 0;

    if (!editedCod || !editedRef) {
      showToast('error', 'El código y la descripción son obligatorios.');
      return;
    }

    setCatalog(prev => {
      const updated = [...prev];
      updated[originalIndex] = {
        cod: editedCod,
        ref: editedRef,
        marca: editedMarca,
        und: editedUnd,
        precio: editedPrecio,
        peso: editedPeso
      };
      localStorage.setItem('liq_catalog', JSON.stringify(updated));
      return updated;
    });

    setEditingCatalogIdx(null);
    showToast('success', 'Producto actualizado en el catálogo.');
  };

  const handleDeleteCatalogProduct = (cod: string, ref: string) => {
    setConfirmState({
      isOpen: true,
      title: 'ELIMINAR PRODUCTO',
      message: `¿Estás seguro de eliminar el producto "${ref}" del catálogo?`,
      onConfirm: () => {
        const updated = catalog.filter(p => !(p.cod === cod && p.ref === ref));
        setCatalog(updated);
        localStorage.setItem('liq_catalog', JSON.stringify(updated));
        showToast('success', 'Producto removido del catálogo.');
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddNewCatalogProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatalogCod.trim() || !newCatalogRef.trim() || !newCatalogMarca.trim()) {
      showToast('error', 'Por favor llena los campos código, descripción y marca.');
      return;
    }

    const newItem = {
      cod: newCatalogCod.trim(),
      ref: newCatalogRef.trim(),
      marca: newCatalogMarca.trim(),
      und: newCatalogUnd,
      precio: newCatalogPrecio,
      peso: newCatalogPeso
    };

    setCatalog(prev => {
      const updated = [newItem, ...prev];
      localStorage.setItem('liq_catalog', JSON.stringify(updated));
      return updated;
    });

    setNewCatalogCod('');
    setNewCatalogRef('');
    setNewCatalogMarca('');
    setNewCatalogUnd(24);
    setNewCatalogPrecio(0);
    setNewCatalogPeso(0);
    setIsAddingProduct(false);
    setCatalogPage(1);
    showToast('success', 'Nuevo producto agregado exitosamente.');
  };

  // --- CLIENT MANAGEMENT ADMIN METHODS ---
  const handleSaveClientEdit = (originalKey: string) => {
    const editKey = editingClientKey;
    if (!editKey) return;

    const parsedName = editClientName.trim();
    const parsedSucursales = editClientSucursales.split(',').map(s => s.trim()).filter(s => s);
    const parsedMarcas = editClientMarcas.split(',').map(s => s.trim()).filter(s => s);

    if (!parsedName) {
      showToast('error', 'El nombre del cliente no puede estar vacío');
      return;
    }

    setClientes(prev => {
      const copy = { ...prev };
      if (parsedName !== originalKey) {
        delete copy[originalKey];
      }
      copy[parsedName] = {
        sucursales: parsedSucursales,
        marcas: parsedMarcas
      };
      localStorage.setItem('liq_clientes', JSON.stringify(copy));
      return copy;
    });

    setEditingClientKey(null);
    showToast('success', 'Información de cliente guardada.');
  };

  const handleDeleteClient = (key: string) => {
    setConfirmState({
      isOpen: true,
      title: 'ELIMINAR CLIENTE',
      message: `¿Estás seguro de eliminar el cliente "${key}" del liquidador?`,
      onConfirm: () => {
        setClientes(prev => {
          const copy = { ...prev };
          delete copy[key];
          localStorage.setItem('liq_clientes', JSON.stringify(copy));
          return copy;
        });
        showToast('success', 'Cliente removido.');
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newClientName.trim();
    if (!name) return;

    if (clientes[name]) {
      showToast('error', 'Este cliente ya existe.');
      return;
    }

    setClientes(prev => {
      const updated = {
        ...prev,
        [name]: {
          sucursales: ['PRINCIPAL'],
          marcas: []
        }
      };
      localStorage.setItem('liq_clientes', JSON.stringify(updated));
      return updated;
    });

    setNewClientName('');
    setIsAddingClient(false);
    showToast('success', 'Nuevo cliente inicializado (configura sus sucursales y marcas).');
  };

  // Pagination for Historial
  const paginatedHistorial = useMemo(() => {
    const start = (historialPage - 1) * historyItemsPerPage;
    return historial.slice(start, start + historyItemsPerPage);
  }, [historial, historialPage]);

  const totalHistoryPages = Math.ceil(historial.length / historyItemsPerPage) || 1;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Toast Notification HUD */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-lg border shadow-2xl z-[99999] flex items-center gap-3 animate-fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-hud-green/10 border-hud-green text-hud-green' 
            : 'bg-hud-red/10 border-hud-red text-hud-red'
        }`}>
          {toastMessage.type === 'success' ? <Sparkles className="w-5 h-5 shrink-0 animate-bounce" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="text-xs uppercase font-mono font-bold tracking-wider">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-hud-card border border-hud-border p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden print:hidden glow-border">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-hud-accent tracking-wide uppercase flex items-center gap-2">
            <Sliders className="w-6 h-6 text-hud-accent" />
            Liquidador de Carga de Pedidos
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-wider">
            Consolidador financiero express de solicitudes de compra y auditoría de cubicaje.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input 
            type="file" 
            id="global-db-import" 
            accept=".json" 
            className="hidden" 
            onChange={handleUploadDatabaseBackup} 
          />
          <button 
            onClick={() => document.getElementById('global-db-import')?.click()} 
            className="bg-slate-900 border border-hud-border/40 hover:bg-slate-800 text-slate-300 font-mono text-[10px] px-3.5 py-2.5 rounded-lg font-bold tracking-widest transition-all hover:scale-[1.01]"
          >
            📂 CARGAR BASE (.JSON)
          </button>
          
          <button 
            onClick={handleDownloadDatabaseBackup} 
            className="bg-slate-900 border border-hud-border/40 hover:bg-slate-800 text-slate-300 font-mono text-[10px] px-3.5 py-2.5 rounded-lg font-bold tracking-widest transition-all hover:scale-[1.01]"
          >
            💾 RESPALDAR BASE (.JSON)
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs bar */}
      <div className="flex border-b border-hud-border/30 gap-1 print:hidden">
        <button
          onClick={() => setActiveSubTab('liquidacion')}
          className={`px-5 py-3.5 font-mono text-xs font-bold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'liquidacion'
              ? 'border-hud-accent text-hud-accent bg-hud-accent/5'
              : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-950/20'
          }`}
        >
          <Sliders className="w-4 h-4" />
          General de Liquidación
        </button>
        
        <button
          onClick={() => setActiveSubTab('catalogo')}
          className={`px-5 py-3.5 font-mono text-xs font-bold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'catalogo'
              ? 'border-hud-accent text-hud-accent bg-hud-accent/5'
              : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-950/20'
          }`}
        >
          <Database className="w-4 h-4" />
          Configuración Catálogo
        </button>

        <button
          onClick={() => setActiveSubTab('clientes')}
          className={`px-5 py-3.5 font-mono text-xs font-bold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'clientes'
              ? 'border-hud-accent text-hud-accent bg-hud-accent/5'
              : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-950/20'
          }`}
        >
          <Users className="w-4 h-4" />
          Filtro de Clientes
        </button>

        <button
          onClick={() => setActiveSubTab('historial')}
          className={`px-5 py-3.5 font-mono text-xs font-bold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'historial'
              ? 'border-hud-accent text-hud-accent bg-hud-accent/5'
              : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-950/20'
          }`}
        >
          <History className="w-4 h-4" />
          Historial Local
        </button>
      </div>

      {/* SUB-TABS SCREENS */}

      {/* 1. LIQUIDACION TAB */}
      {activeSubTab === 'liquidacion' && (
        <div className="space-y-6">
          {/* Main ERP parameter bar */}
          <div className="bg-hud-card border border-hud-border/70 rounded-xl p-5 space-y-4 print:bg-white print:border-none print:shadow-none print:p-0">
            <h4 className="text-xs font-mono font-bold text-hud-accent tracking-widest uppercase flex items-center gap-2 print:hidden">
              <span className="w-1.5 h-1.5 bg-hud-accent rounded-full pulse-led"></span>
              METADATOS DEL PEDIDO (ERP / DOCUMENTOS)
            </h4>

            {/* Inputs grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">TIPO/BUSCAR CLIENTE</label>
                  {searchClientDropdownQuery && (
                    <button
                      onClick={() => setSearchClientDropdownQuery('')}
                      className="text-[9px] font-mono text-hud-red hover:underline uppercase"
                      title="Limpiar consulta"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Digita para filtrar..."
                  value={searchClientDropdownQuery}
                  onChange={(e) => setSearchClientDropdownQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-hud-border/50 text-slate-200 rounded-lg h-10 px-3 font-mono text-xs focus:border-hud-accent outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">CLIENTE DIRECTO</label>
                <select
                  value={clienteActual}
                  onChange={(e) => {
                    const c = e.target.value;
                    setClienteActual(c);
                    setSucursalActual('');
                    setPedido({});
                    setPreciosPV({});
                    setSelectedProductIndex({});
                  }}
                  className="w-full bg-slate-950 border border-hud-border/50 text-slate-200 rounded-lg h-10 px-3 font-mono text-xs focus:border-hud-accent outline-none font-bold"
                >
                  <option value="">— SELECCIONAR CLIENTE —</option>
                  {Object.keys(clientes)
                    .filter(c => {
                      const q = searchClientDropdownQuery.toLowerCase().trim();
                      if (!q) return true;
                      return c.toLowerCase().includes(q);
                    })
                    .map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">SUCURSAL / DESTINO</label>
                <select
                  value={sucursalActual}
                  onChange={(e) => {
                    setSucursalActual(e.target.value);
                    setPedido({});
                    setPreciosPV({});
                    setSelectedProductIndex({});
                  }}
                  disabled={!clienteActual}
                  className="w-full bg-slate-950 border border-hud-border/50 text-slate-200 rounded-lg h-10 px-3 font-mono text-xs focus:border-hud-accent outline-none disabled:opacity-40"
                >
                  <option value="">— SELECCIONAR SUCURSAL —</option>
                  {clienteActual && clientes[clienteActual]?.sucursales.map((s: string) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">NÚMERO PV (PEDIDO DE VENTA)</label>
                <input
                  type="text"
                  placeholder="Ej: PV 2070"
                  value={pvNum}
                  onChange={(e) => setPvNum(e.target.value)}
                  className="w-full bg-slate-950 border border-hud-border/50 text-slate-200 rounded-lg h-10 px-3 font-mono text-xs focus:border-hud-accent outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">CÓDIGO OC (ORDEN DE COMPRA)</label>
                <input
                  type="text"
                  placeholder="Ej: OC-COE-00000081"
                  value={pvOc}
                  onChange={(e) => setPvOc(e.target.value)}
                  className="w-full bg-slate-950 border border-hud-border/50 text-slate-200 rounded-lg h-10 px-3 font-mono text-xs focus:border-hud-accent outline-none"
                />
              </div>
            </div>

            {/* Document parser and manual fill block */}
            <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
              <div className="flex items-center gap-3">
                <FileUp className="w-8 h-8 text-hud-accent animate-pulse shrink-0" />
                <div className="space-y-1">
                  <h5 className="text-xs font-mono font-bold text-slate-200 uppercase">MÓDULO LECTOR AUTOMÁTICO DE ARCHIVO PDF</h5>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {isPdfLibLoading ? 'Iniciando parser PDF en segundo plano...' : 'Sube tu PDF del pedido para pre-llenar las cantidades y precios automáticamente.'}
                  </p>
                  {selectedPdfFile && (
                    <div className="flex items-center gap-2 mt-2 bg-hud-accent/10 border border-hud-accent/20 rounded px-2.5 py-1 text-[10px] text-hud-accent font-semibold flex-wrap">
                      <span className="w-1.5 h-1.5 bg-hud-accent rounded-full animate-ping"></span>
                      <span>Archivo seleccionado: <span className="font-bold underline">{selectedPdfFile.name}</span> ({(selectedPdfFile.size / 1024).toFixed(1)} KB)</span>
                      <button 
                        onClick={() => {
                          setSelectedPdfFile(null);
                          setPdfStatus('');
                          if (pdfInputRef.current) pdfInputRef.current.value = '';
                        }}
                        className="text-hud-red hover:text-white font-bold ml-2 underline uppercase text-[9px] cursor-pointer"
                        title="Quitar Archivo"
                      >
                        [ Quitar ]
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end">
                {pdfStatus && (
                  <span className="text-[10px] font-mono font-bold text-hud-green uppercase px-3.5 py-2.5 rounded-lg border border-hud-green/20 bg-hud-green/5 max-w-xs truncate">
                    {pdfStatus}
                  </span>
                )}

                <input 
                  type="file" 
                  ref={pdfInputRef} 
                  accept=".pdf" 
                  className="hidden" 
                  onChange={handlePdfUpload} 
                />
                
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="bg-slate-900 border border-hud-border/40 hover:bg-slate-800 text-slate-200 font-mono font-bold text-[10px] px-4 py-2.5 rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  SELECCIONAR PDF
                </button>

                {selectedPdfFile && (
                  <button
                    onClick={handleExecutePdfLoad}
                    className="bg-hud-green hover:bg-hud-green/90 text-slate-950 font-mono font-extrabold text-[10px] px-4 py-2.5 rounded-lg uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3px]" />
                    CARGAR PV
                  </button>
                )}

                <button
                  onClick={handlePreFillDemo}
                  className="bg-slate-900 border border-hud-border/40 hover:bg-slate-800 text-hud-accent font-mono text-[10px] px-4 py-2.5 rounded-lg font-bold tracking-widest transition-all cursor-pointer"
                >
                  ⚡ IMPORTAR DEMO (PV 2070)
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics display row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-hud-card border border-hud-border/40 rounded-xl p-5 relative overflow-hidden">
              <span className="text-[9px] font-mono font-bold text-hud-accent uppercase tracking-widest block">Suma Total Cajas</span>
              <div className="text-2xl font-display font-black text-slate-100 mt-1">{fmtD(totals.cajas)}</div>
              <span className="text-[9px] font-mono text-slate-500 block uppercase mt-0.5">Unidades de embalaje</span>
            </div>

            <div className="bg-hud-card border border-hud-border/40 rounded-xl p-5 relative overflow-hidden">
              <span className="text-[9px] font-mono font-bold text-hud-accent uppercase tracking-widest block">Suma Total Unidades</span>
              <div className="text-2xl font-display font-black text-slate-100 mt-1">{fmt(totals.unidades)}</div>
              <span className="text-[9px] font-mono text-slate-500 block uppercase mt-0.5">Piezas comerciales sueltas</span>
            </div>

            <div className="bg-hud-card border border-hud-border/40 rounded-xl p-5 relative overflow-hidden">
              <span className="text-[9px] font-mono font-bold text-hud-accent uppercase tracking-widest block">Peso Bruto Total</span>
              <div className="text-2xl font-display font-black text-slate-100 mt-1">{fmt(totals.peso)} kg</div>
              <span className="text-[9px] font-mono text-slate-500 block uppercase mt-0.5">Métrica de cubicaje de transporte</span>
            </div>

            <div className="bg-hud-card border border-hud-border/40 rounded-xl p-5 relative overflow-hidden border-b-2 border-b-hud-green">
              <span className="text-[9px] font-mono font-bold text-hud-green uppercase tracking-widest block">Subtotal sin IVA</span>
              <div className="text-2xl font-display font-black text-hud-green mt-1">${fmt(totals.subtotal)}</div>
              <span className="text-[9px] font-mono text-slate-500 block uppercase mt-0.5">Suma valor comercial COP</span>
            </div>
          </div>

          {/* User Operation Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            <button
              onClick={handleSavePV}
              disabled={totals.cajas === 0}
              className="bg-hud-green hover:bg-hud-green/90 disabled:opacity-45 text-slate-950 font-mono font-bold text-xs px-5 py-3 rounded-lg flex items-center gap-2 transition-all tracking-wider uppercase font-extrabold cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Guardar en Historial
            </button>

            <button
              onClick={() => {
                // Download summary JSON
                const resumen = {
                  cliente: clienteActual,
                  sucursal: sucursalActual,
                  fecha: pvFecha,
                  totalCajas: totals.cajas,
                  totalUnds: totals.unidades,
                  totalPeso: totals.peso,
                  totalSubtotal: totals.subtotal,
                  items: Object.entries(pedido).map(([cod, cajasVal]) => {
                    const cajas = cajasVal as number;
                    const p = catalog.find(x => x.cod === cod);
                    const units = cajas * (p?.und || 24);
                    const price = preciosPV[cod] !== undefined ? preciosPV[cod] : (p?.precio || 0);
                    return {
                      cod,
                      cajas,
                      unidades: units,
                      precio: price,
                      subtotal: units * price,
                      peso: cajas * (p?.peso || 0)
                    };
                  })
                };
                const blob = new Blob([JSON.stringify(resumen, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Resumen_PV_Liquidado_${clienteActual}_${pvNum || 'SinNumero'}.json`;
                a.click();
              }}
              disabled={totals.cajas === 0}
              className="bg-slate-900 border border-hud-border/30 text-slate-200 hover:bg-slate-800 disabled:opacity-45 font-mono font-bold text-xs px-5 py-3 rounded-lg flex items-center gap-2 transition-all tracking-wider uppercase cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Descargar Resumen (.json)
            </button>

            <button
              onClick={handlePrintView}
              className="bg-slate-900 border border-hud-border/30 text-slate-200 hover:bg-slate-800 font-mono font-bold text-xs px-5 py-3 rounded-lg flex items-center gap-2 transition-all tracking-wider uppercase cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Liquidación
            </button>

            <button
              onClick={handleClearBilling}
              className="bg-slate-950 border border-hud-red/30 text-hud-red hover:bg-hud-red/10 font-mono font-bold text-xs px-5 py-3 rounded-lg flex items-center gap-2 transition-all tracking-wider uppercase ml-auto cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Limpiar Todo
            </button>
          </div>

          {/* Spreadsheet order items grid */}
          <div className="bg-hud-card border border-hud-border rounded-xl spill-hidden">
            {/* Table Header block */}
            <div className="p-4 border-b border-hud-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 print:bg-slate-200 print:text-black">
              <div>
                <h4 className="text-xs font-mono font-bold text-[#00ffa3] uppercase print:text-black print:text-sm">
                  REPORTE DE REFERENCIAS CORRESPONDIENTES A MARCAS AUTORIZADAS
                </h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase print:hidden">
                  Mostrando catálogo filtrado por marcas contratadas de {clienteActual || 'sin cliente'}.
                </p>
              </div>

              {/* Show only filled elements filter toggle */}
              <div className="flex items-center gap-2 shrink-0 print:hidden">
                <label className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={verSoloPV}
                    onChange={(e) => setVerSoloPV(e.target.checked)}
                    className="w-4 h-4 bg-slate-950 border border-hud-border rounded cursor-pointer accent-hud-accent"
                  />
                  <Filter className="w-3.5 h-3.5" />
                  VER SOLO REPORTADAS EN PV
                </label>
              </div>
            </div>

            {/* Main Interactive Table Grid */}
            <div className="overflow-x-auto">
              {!clienteActual || !sucursalActual ? (
                <div className="p-16 text-center text-slate-500 font-mono border border-transparent rounded-lg">
                  <AlertTriangle className="w-8 h-8 text-hud-orange animate-bounce mx-auto mb-3" />
                  SELECCIONA UN CLIENTE DIRECTO Y SU SUCURSAL DESTINO PARA DESBLOQUEAR EL INGRESO DE REPORTES
                </div>
              ) : filteredProductsByCliente.length === 0 ? (
                <div className="p-16 text-center text-slate-500 font-mono border border-transparent rounded-lg">
                  No hay marcas ni productos registrados en el catálogo de marcas para este cliente. Configúralos en las pestañas administrativas.
                </div>
              ) : (
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/90 text-slate-400 border-b border-hud-border/40 print:bg-slate-100 print:text-black">
                      <th className="p-3 font-semibold uppercase text-[10px]">CÓDIGO</th>
                      <th className="p-3 font-semibold uppercase text-[10px]">DESCRIPCIÓN COMERCIAL</th>
                      <th className="p-3 font-semibold uppercase text-[10px] text-center">EMBALAJE (UND/CAJA)</th>
                      <th className="p-3 font-semibold uppercase text-[10px] text-right">PRECIO UNITARIO</th>
                      <th className="p-3 font-semibold uppercase text-[10px] text-center w-28">CAJAS</th>
                      <th className="p-3 font-semibold uppercase text-[10px] text-center w-28">UNIDADES</th>
                      <th className="p-3 font-semibold uppercase text-[10px] text-right">PESO (KG)</th>
                      <th className="p-3 font-semibold uppercase text-[10px] text-right">SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hud-border/20 print:text-black">
                    {Object.keys(groupedProductsByCode).map(cod => {
                      const products = groupedProductsByCode[cod];
                      const cajas = pedido[cod] || 0;
                      
                      // Filter if "Only PV items" checkbox is active
                      if (verSoloPV && cajas <= 0) return null;

                      // Retrieve currently active selection for duplicates mapping
                      let activeProd = null;
                      const savedIdx = selectedProductIndex[cod];
                      if (savedIdx !== undefined) {
                        activeProd = products.find(prod => prod.originalIndex === savedIdx);
                      }
                      if (!activeProd) {
                        activeProd = products[0];
                      }

                      const p = activeProd;
                      const unds = cajas * p.und;
                      const finalWeight = cajas * p.peso;
                      const finalPrecio = preciosPV[cod] !== undefined ? preciosPV[cod] : p.precio;
                      const subtotal = unds * finalPrecio;
                      const isFractional = cajas > 0 && Math.abs(cajas - Math.round(cajas)) > 0.001;

                      return (
                        <tr key={cod} className={`hover:bg-slate-900/10 transition-colors ${cajas > 0 ? 'bg-hud-accent/5' : ''} print:hover:bg-transparent`}>
                          <td className="p-3 font-bold text-slate-400">{cod}</td>
                          <td className="p-3">
                            <div className="space-y-1">
                              {products.length === 1 ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-100 font-bold font-sans print:text-black">{p.ref}</span>
                                  <span className="text-[9px] bg-slate-900 border border-hud-border/40 text-hud-accent px-1.5 py-0.5 rounded font-bold uppercase">{p.marca}</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 w-full max-w-md print:hidden">
                                  <span className="text-[10px] text-[#e67e22] font-mono font-bold uppercase flex items-center gap-1">
                                    ⚠️ DUPLICADO - REFS DISPONIBLES:
                                  </span>
                                  <select
                                    value={p.originalIndex}
                                    onChange={(e) => {
                                      const idx = parseInt(e.target.value);
                                      setSelectedProductIndex(prev => ({ ...prev, [cod]: idx }));
                                    }}
                                    className="h-8 bg-slate-950 border border-[#e67e22]/50 text-slate-200 rounded px-2 text-xs focus:border-[#e67e22] outline-none"
                                  >
                                    {products.map(prod => (
                                      <option key={prod.originalIndex} value={prod.originalIndex}>
                                        {prod.ref} ({prod.marca}) — {prod.und}U — ${fmt(prod.precio)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {isFractional && (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-hud-orange/10 border border-hud-orange/30 text-hud-orange px-2 py-0.5 rounded font-black font-sans uppercase">
                                  ⚠️ Cajas Incompletas (Fracción)
                                </span>
                              )}
                            </div>
                            
                            {/* Static print representation of duplicates selection */}
                            <div className="hidden print:block font-bold">
                              {p.ref} <span className="text-[9px] border border-black p-0.5">({p.marca})</span>
                            </div>
                          </td>
                          <td className="p-3 text-center font-bold text-slate-300">{p.und}</td>
                          <td className="p-3 text-right font-bold text-slate-300">${fmt(finalPrecio)}</td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              value={cajas > 0 ? Number(cajas.toFixed(2)) : ''}
                              onChange={(e) => handleUpdateProductQty(cod, e.target.value, 'cajas')}
                              className="w-full bg-slate-950/80 border border-hud-border/40 text-slate-100 placeholder-slate-700 h-8 rounded text-center focus:border-hud-accent outline-none print:border-none print:bg-transparent"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={unds > 0 ? Number(unds.toFixed(2)) : ''}
                              onChange={(e) => handleUpdateProductQty(cod, e.target.value, 'unidades')}
                              className="w-full bg-slate-950/40 border border-hud-accent/25 text-slate-400 placeholder-slate-800 h-8 rounded text-center focus:border-hud-accent outline-none print:border-none print:bg-transparent"
                            />
                          </td>
                          <td className="p-3 text-right text-slate-450 font-bold">{finalWeight > 0 ? fmtD(finalWeight) : '-'}</td>
                          <td className="p-3 text-right font-bold text-[#00ffa3]">{subtotal > 0 ? '$' + fmt(subtotal) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Direct table footer sum row */}
            {totals.cajas > 0 && (
              <div className="p-5 border-t border-hud-border bg-slate-950/45 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-mono font-bold">
                <span className="text-slate-400 uppercase">RESUMEN LIQUIDACIÓN EXCLUSIVO:</span>
                <span className="text-[#00ffa3] uppercase space-x-4">
                  <span>CAJAS: {fmtD(totals.cajas)}</span>
                  <span>|</span>
                  <span>UNIDADES: {fmt(totals.unidades)}</span>
                  <span>|</span>
                  <span>PESO: {fmtD(totals.peso)} KG</span>
                  <span>|</span>
                  <span>SUBTOTAL: ${fmt(totals.subtotal)} COP</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. CATALOGO ADMIN TAB */}
      {activeSubTab === 'catalogo' && (
        <div className="bg-hud-card border border-hud-border rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hud-border/20 pb-4">
            <div>
              <h3 className="text-sm font-mono font-bold text-hud-accent uppercase">MANTENIMIENTO INTEGRAL DE CATÁLOGO GENERAL</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Modifica los códigos, marcas, embalajes, precios unitarios base y factores de peso en kilogramos de toda la compañía.
              </p>
            </div>

            {/* Toggle add product layout button */}
            <button
              onClick={() => setIsAddingProduct(!isAddingProduct)}
              className="bg-hud-accent hover:bg-hud-accent/90 text-slate-950 font-mono font-bold text-[10px] px-4.5 py-2.5 rounded-lg flex items-center gap-1.5 uppercase transition-all tracking-wider ml-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isAddingProduct ? 'Cancelar Formulario' : 'Nuevo Producto'}
            </button>
          </div>

          {/* New product addition block form */}
          {isAddingProduct && (
            <form onSubmit={handleAddNewCatalogProduct} className="bg-slate-950/70 p-5 rounded-lg border border-hud-accent/20 space-y-4 font-mono text-xs max-w-xl mx-auto">
              <h4 className="text-xs font-mono font-black text-hud-accent uppercase tracking-wider">CREAR NUEVA REFERENCIA DE PRODUCTO</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Descripción o Nombre Comercial de la Referencia</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Citronela Belalcázar Especial 3L"
                    value={newCatalogRef}
                    onChange={(e) => setNewCatalogRef(e.target.value)}
                    className="w-full bg-slate-900 border border-hud-border/40 text-slate-105 rounded px-3 h-9 outline-none focus:border-hud-accent"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">CÓDIGO ÚNICO PLU/SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 01020120"
                    value={newCatalogCod}
                    onChange={(e) => setNewCatalogCod(e.target.value)}
                    className="w-full bg-slate-900 border border-hud-border/40 text-slate-105 rounded px-3 h-9 outline-none focus:border-hud-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">MARCA COMERCIAL</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Belalcázar"
                    value={newCatalogMarca}
                    onChange={(e) => setNewCatalogMarca(e.target.value)}
                    className="w-full bg-slate-900 border border-hud-border/40 text-slate-105 rounded px-3 h-9 outline-none focus:border-hud-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">UND / EMBALAJE CAJA</label>
                  <input
                    type="number"
                    min="1"
                    value={newCatalogUnd}
                    onChange={(e) => setNewCatalogUnd(parseInt(e.target.value) || 24)}
                    className="w-full bg-slate-900 border border-hud-border/40 text-slate-150 rounded px-3 h-9 outline-none focus:border-hud-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">PRECIO UNITARIO SIN IVA</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCatalogPrecio}
                    onChange={(e) => setNewCatalogPrecio(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-hud-border/40 text-slate-150 rounded px-3 h-9 outline-none focus:border-hud-accent"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">PESO POR CAJA (KILOGRAMOS BRUTOS)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCatalogPeso}
                    onChange={(e) => setNewCatalogPeso(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-hud-border/40 text-slate-150 rounded px-3 h-9 outline-none focus:border-hud-accent"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-hud-green hover:bg-hud-green/90 text-slate-950 font-bold px-4 py-2.5 rounded text-[10px] tracking-widest uppercase cursor-pointer"
                >
                  Agregar Referencia
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingProduct(false)}
                  className="bg-slate-900 hover:bg-slate-800 border border-hud-border/30 text-slate-200 font-bold px-4 py-2.5 rounded text-[10px] tracking-widest uppercase cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Filtering bar in admin Catalogue */}
          <div className="flex items-center gap-3 bg-slate-950/45 p-3.5 border border-slate-900 rounded-lg">
            <Search className="w-4 h-4 text-hud-accent" />
            <input
              type="text"
              placeholder="Buscar por código SKU, descripción comercial o marca registrada..."
              value={searchCatalogQuery}
              onChange={(e) => {
                setSearchCatalogQuery(e.target.value);
                setCatalogPage(1);
              }}
              className="flex-1 bg-transparent text-slate-200 text-xs font-mono outline-none placeholder-slate-600"
            />
          </div>

          {/* Table display */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-hud-border/30">
                  <th className="p-3 col-cod">CÓDIGO PLU/SKU</th>
                  <th className="p-3">REFERENCIA NOMBRE COMERCIAL</th>
                  <th className="p-3">MARCA</th>
                  <th className="p-3 text-center">EMBALAJE INDS</th>
                  <th className="p-2.5 text-right">PRECIO BASE SIN IVA</th>
                  <th className="p-2.5 text-right">PESO KG</th>
                  <th className="p-3 text-center w-28">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hud-border/10">
                {paginatedCatalogForAdmin.map((p, idx) => {
                  const isEditing = editingCatalogIdx === idx;
                  return (
                    <tr key={`${p.cod}-${p.ref}-${idx}`} className="hover:bg-slate-910/20 transition-colors">
                      <td className="p-3 font-semibold text-slate-400">
                        {isEditing ? (
                          <input
                            type="text"
                            id={`edit-cod-${idx}`}
                            className="bg-slate-950 border border-hud-border text-slate-200 text-xs h-7 px-2 w-28 font-mono rounded"
                            defaultValue={p.cod}
                          />
                        ) : (
                          p.cod
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-200 font-sans">
                        {isEditing ? (
                          <input
                            type="text"
                            id={`edit-ref-${idx}`}
                            className="bg-slate-950 border border-hud-border text-slate-250 text-xs h-7 px-2 w-full font-mono rounded"
                            defaultValue={p.ref}
                          />
                        ) : (
                          p.ref
                        )}
                      </td>
                      <td className="p-3 text-slate-300">
                        {isEditing ? (
                          <input
                            type="text"
                            id={`edit-marca-${idx}`}
                            className="bg-slate-950 border border-hud-border text-slate-200 text-xs h-7 px-2 w-28 font-mono rounded"
                            defaultValue={p.marca}
                          />
                        ) : (
                          p.marca
                        )}
                      </td>
                      <td className="p-3 text-center text-slate-350">
                        {isEditing ? (
                          <input
                            type="number"
                            id={`edit-und-${idx}`}
                            className="bg-slate-950 border border-hud-border text-slate-200 text-xs h-7 px-2 w-16 text-center font-mono rounded"
                            defaultValue={p.und}
                          />
                        ) : (
                          p.und
                        )}
                      </td>
                      <td className="p-2.5 text-right font-bold text-hud-green">
                        {isEditing ? (
                          <input
                            type="number"
                            id={`edit-precio-${idx}`}
                            step="0.01"
                            className="bg-slate-950 border border-hud-border text-slate-200 text-xs h-7 px-2 w-24 text-right font-mono rounded"
                            defaultValue={p.precio}
                          />
                        ) : (
                          `$${fmt(p.precio)}`
                        )}
                      </td>
                      <td className="p-2.5 text-right text-slate-400">
                        {isEditing ? (
                          <input
                            type="number"
                            id={`edit-peso-${idx}`}
                            step="0.01"
                            className="bg-slate-950 border border-hud-border text-slate-200 text-xs h-7 px-2 w-20 text-right font-mono rounded"
                            defaultValue={p.peso}
                          />
                        ) : (
                          p.peso
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              onClick={() => handleSaveCatalogEdit(idx)}
                              className="bg-hud-green border border-hud-green/40 hover:bg-hud-green/80 text-slate-950 rounded p-1"
                              title="Guardar Cambios"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCatalogIdx(null)}
                              className="bg-slate-900 border border-hud-border/20 text-slate-400 rounded p-1 hover:text-slate-100"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              onClick={() => setEditingCatalogIdx(idx)}
                              className="bg-slate-900 border border-hud-border/20 text-hud-accent rounded p-1 hover:bg-hud-accent/10"
                              title="Editar Inline"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCatalogProduct(p.cod, p.ref)}
                              className="bg-slate-900 border border-hud-border/20 text-hud-red rounded p-1 hover:bg-hud-red/10"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {paginatedCatalogForAdmin.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                      No se encontraron resultados de productos en el catálogo para tu búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Catalog Pagination navigation */}
          {totalCatalogPages > 1 && (
            <div className="flex items-center justify-between border-t border-hud-border/20 pt-4 font-mono text-xs">
              <span className="text-slate-550">
                Mostrando {paginatedCatalogForAdmin.length} items de {filteredCatalogForAdmin.length} totales registrados
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={catalogPage === 1}
                  onClick={() => setCatalogPage(prev => Math.max(1, prev - 1))}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 px-3 py-1.5 h-8 font-bold border border-hud-border/40 rounded transition-all cursor-pointer"
                >
                  ATRÁS
                </button>
                <span className="text-slate-300 font-bold bg-[#040814] h-8 px-4 flex items-center rounded border border-hud-border/20">
                  PÁGINA {catalogPage} / {totalCatalogPages}
                </span>
                <button
                  disabled={catalogPage === totalCatalogPages}
                  onClick={() => setCatalogPage(prev => Math.min(totalCatalogPages, prev + 1))}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 px-3 py-1.5 h-8 font-bold border border-hud-border/40 rounded transition-all cursor-pointer"
                >
                  SIGUIENTE
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. CLIENT MANAGEMENT TAB */}
      {activeSubTab === 'clientes' && (
        <div className="bg-hud-card border border-hud-border rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hud-border/20 pb-4">
            <div>
              <h3 className="text-sm font-mono font-bold text-hud-accent uppercase">MÓDULO DE CLIENTES, MARCAS Y SU_CURSALES</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Modifica y filtra qué marcas (catálogos de producto) y cuáles sucursales son válidas para facturar a cada empresa cliente.
              </p>
            </div>

            <button
              onClick={() => setIsAddingClient(!isAddingClient)}
              className="bg-hud-accent hover:bg-hud-accent/90 text-slate-950 font-mono font-bold text-[10px] px-4.5 py-2.5 rounded-lg flex items-center gap-1.5 uppercase transition-all tracking-wider ml-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isAddingClient ? 'Cancelar' : 'Nuevo Cliente'}
            </button>
          </div>

          {/* New Customer Form */}
          {isAddingClient && (
            <form onSubmit={handleAddNewClient} className="bg-slate-950/70 p-5 rounded-lg border border-hud-accent/20 space-y-4 font-mono text-xs max-w-sm mx-auto">
              <h4 className="text-xs font-mono font-black text-hud-accent uppercase tracking-wider">CREAR NUEVA ENTIDAD CLIENTE</h4>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Nombre Completo del Cliente/Empresa</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: SUPERMERCADOS BELALCÁZAR LIMITADA"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-slate-900 border border-hud-border/40 text-slate-105 rounded px-3 h-9 outline-none focus:border-hud-accent"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-hud-green hover:bg-hud-green/90 text-slate-950 font-bold px-4 py-2.5 rounded text-[10px] tracking-widest uppercase cursor-pointer"
                >
                  Agregar Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingClient(false)}
                  className="bg-slate-900 hover:bg-slate-800 border border-hud-border/30 text-slate-205 font-bold px-4 py-2.5 rounded text-[10px] tracking-widest uppercase cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Filtering bar in admin Clientes */}
          <div className="flex items-center gap-3 bg-slate-950/45 p-3.5 border border-slate-900 rounded-lg">
            <Search className="w-4 h-4 text-hud-accent" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre, marca registrada o sucursal..."
              value={searchClientQuery}
              onChange={(e) => setSearchClientQuery(e.target.value)}
              className="flex-1 bg-transparent text-slate-200 text-xs font-mono outline-none placeholder-slate-600"
            />
          </div>

          {/* Database display inside clients */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400">
                  <th style={{ width: '260px' }}>Cliente</th>
                  <th>Sucursales (separadas por coma)</th>
                  <th>Marcas Propias (separadas por coma)</th>
                  <th className="text-center w-[120px]">Operaciones</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(clientes)
                  .filter(([key, itemVal]) => {
                    const q = searchClientQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                    if (!q) return true;
                    const item = itemVal as any;
                    const nameMatch = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q);
                    const sucursalMatch = item.sucursales?.some((s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q));
                    const marcaMatch = item.marcas?.some((m: string) => m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q));
                    return nameMatch || sucursalMatch || marcaMatch;
                  })
                  .map(([key, itemVal], idxInLoop) => {
                    const item = itemVal as any;
                    const isEditing = editingClientKey === key;
                  return (
                    <tr key={key} className="hover:bg-slate-910/20 border-b border-hud-border/10">
                      <td className="p-3 font-semibold text-hud-accent font-sans">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editClientName}
                            onChange={(e) => setEditClientName(e.target.value)}
                            className="bg-slate-950 border border-hud-border text-slate-250 text-xs h-8 px-2 w-full font-mono rounded"
                          />
                        ) : (
                          key
                        )}
                      </td>
                      <td className="p-3 text-slate-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editClientSucursales}
                            onChange={(e) => setEditClientSucursales(e.target.value)}
                            placeholder="SUCURSAL A, SUCURSAL B"
                            className="bg-slate-950 border border-hud-border text-slate-200 text-xs h-8 px-2 w-full font-mono rounded"
                          />
                        ) : (
                          item.sucursales?.join(', ') || 'N/A'
                        )}
                      </td>
                      <td className="p-3 text-slate-350">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editClientMarcas}
                            onChange={(e) => setEditClientMarcas(e.target.value)}
                            placeholder="Marca A, Marca B"
                            className="bg-slate-950 border border-hud-border text-slate-200 text-xs h-8 px-2 w-full font-mono rounded"
                          />
                        ) : (
                          item.marcas?.length > 0 ? item.marcas.join(', ') : 'Ninguna (Ve todos los productos)'
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          {isEditing ? (
                            <>
                              <button 
                                onClick={() => handleSaveClientEdit(key)} 
                                className="bg-hud-green border border-hud-green/40 hover:bg-hud-green/80 text-slate-950 rounded p-1"
                                title="Guardar Cambios"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setEditingClientKey(null)} 
                                className="bg-slate-900 border border-hud-border/20 text-slate-400 rounded p-1 hover:text-slate-100"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingClientKey(key);
                                  setEditClientName(key);
                                  setEditClientSucursales(item.sucursales?.join(', ') || '');
                                  setEditClientMarcas(item.marcas?.join(', ') || '');
                                }} 
                                className="bg-slate-900 border border-hud-border/20 text-hud-accent rounded p-1 hover:bg-hud-accent/10"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteClient(key)} 
                                className="bg-slate-900 border border-hud-border/20 text-hud-red rounded p-1 hover:bg-hud-red/10"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. HISTORIAL SUB-TAB */}
      {activeSubTab === 'historial' && (
        <div className="bg-hud-card border border-hud-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-mono font-bold text-hud-accent uppercase">HISTORIAL DE LIQUIDACIONES LOCALES GUARDADAS</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Consultar, cargar para re-auditar, descargar reportes comerciales específicos o eliminar registros archivados en este equipo.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-hud-border/30">
                  <th className="p-3">FECHA/REGISTRO</th>
                  <th className="p-3">NÚM PV</th>
                  <th className="p-3">CLIENTE DIRECTO</th>
                  <th className="p-3">SUCURSAL</th>
                  <th className="p-3 text-right">VALOR COMERCIAL</th>
                  <th className="p-3 text-center w-36">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hud-border/10">
                {paginatedHistorial.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-910/20 transition-colors">
                    <td className="p-3 text-slate-400 font-bold">{item.timestamp}</td>
                    <td className="p-3 text-slate-100 font-black">{item.numPV}</td>
                    <td className="p-3 text-slate-350 font-sans">{item.cliente}</td>
                    <td className="p-3 text-slate-400">{item.sucursal}</td>
                    <td className="p-3 text-right font-bold text-hud-green">${fmt(item.subtotal || 0)}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <button
                          onClick={() => handleLoadPVFromHistory(item)}
                          className="bg-hud-accent hover:bg-hud-accent/90 text-slate-950 font-bold px-2.5 py-1 rounded text-[10px] uppercase tracking-wider"
                        >
                          Cargar
                        </button>
                        <button
                          onClick={() => handleDeletePVFromHistory(item.id)}
                          className="bg-slate-900 border border-hud-border/20 hover:border-hud-red/40 text-hud-red p-1 rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {historial.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                      No hay liquidaciones de PV archivadas en el historial local de este navegador.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Historial pagination */}
          {totalHistoryPages > 1 && (
            <div className="flex items-center justify-between border-t border-hud-border/20 pt-4 font-mono text-xs">
              <span className="text-slate-550">
                Mostrando {paginatedHistorial.length} de {historial.length} registros guardados
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={historialPage === 1}
                  onClick={() => setHistorialPage(prev => Math.max(1, prev - 1))}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 px-3 py-1.5 h-8 font-bold border border-hud-border/40 rounded transition-all cursor-pointer"
                >
                  ATRÁS
                </button>
                <span className="text-slate-300 font-bold bg-[#040814] h-8 px-4 flex items-center rounded border border-hud-border/20">
                  PÁGINA {historialPage} / {totalHistoryPages}
                </span>
                <button
                  disabled={historialPage === totalHistoryPages}
                  onClick={() => setHistorialPage(prev => Math.min(totalHistoryPages, prev + 1))}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 px-3 py-1.5 h-8 font-bold border border-hud-border/40 rounded transition-all cursor-pointer"
                >
                  SIGUIENTE
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== CUSTOM CONFIRMATION DIALOG MODAL ===================== */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-red-500/30 rounded-xl w-full max-w-sm overflow-hidden animate-fade-in shadow-2xl">
            <div className="bg-slate-950 p-4 border-b border-red-500/20 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
              <h3 className="font-display font-extrabold text-red-500 text-xs uppercase tracking-widest leading-none">
                {confirmState.title}
              </h3>
            </div>
            <div className="p-5 space-y-4 font-mono">
              <p className="text-slate-300 text-xs leading-relaxed">
                {confirmState.message}
              </p>
              <div className="flex justify-end gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded text-[11px] font-bold uppercase transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={confirmState.onConfirm}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
