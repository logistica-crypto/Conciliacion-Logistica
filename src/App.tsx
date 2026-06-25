/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Menu, ShieldCheck, Home, ClipboardList, Clock, Truck, ShieldAlert, 
  Map, Users, DollarSign, Bell, Activity, Play, Plus, Search, 
  Download, FileSpreadsheet, Lock, RefreshCw, LogOut, Trash2, CheckCircle2, ChevronDown, ListPlus, Send,
  ChevronLeft, ChevronRight, Upload, AlertTriangle, Sliders, Calendar, ShoppingBag
} from 'lucide-react';

import { Order, Carrier, Customer, Novedad, Reminder } from './types';
import { SEED_CARRIERS, SEED_CUSTOMERS, SEED_ORDERS, SEED_NOVEDADES, SEED_REMINDERS } from './data/seed';
import * as XLSX from 'xlsx';

import HomeModule from './components/HomeModule';
import OrdersModule from './components/OrdersModule';
import AnalyticsModule from './components/AnalyticsModule';
import NovedadesModule from './components/NovedadesModule';
import ProvisionesModule from './components/ProvisionesModule';
import DiferenciasModule from './components/DiferenciasModule';
import RemindersModule from './components/RemindersModule';
import VehiclesModule from './components/VehiclesModule';
import LiquidadorModule from './components/LiquidadorModule';
import CitasModule from './components/CitasModule';
import HorasModule from './components/HorasModule';
import PedidosModule from './components/PedidosModule';
import { saveToCloud, subscribeToCloud } from './firebaseService';

// Safe LocalStorage wrapper to prevent SecurityErrors in sandboxed iframes or private modes
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[Storage] localStorage is disabled or barred (key: ${key}):`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[Storage] localStorage write failed (key: ${key}):`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[Storage] localStorage remove failed (key: ${key}):`, e);
    }
  }
};

// Default PIN for deletion or cancellation
const DELETION_PIN = "1234";

// Compression and decompression for Firestore limits prevention (1MB per document limit)
const compressOrderForCloud = (o: Order) => {
  const compressed: any = {};
  if (o.id) compressed.id = o.id;
  if (o.pv) compressed.pv = o.pv;
  if (o.oc) compressed.oc = o.oc;
  if (o.fechaIngreso) compressed.fi = o.fechaIngreso;
  if (o.fechaSalida) compressed.fs = o.fechaSalida;
  if (o.fechaEntrega) compressed.fe = o.fechaEntrega;
  if (o.fechaFactura) compressed.ff = o.fechaFactura;
  if (o.horaCita) compressed.hc = o.horaCita;
  if (o.cliente) compressed.cl = o.cliente;
  if (o.ciudad) compressed.ci = o.ciudad;
  if (o.origen && o.origen !== "ACOPI-YUMBO") compressed.or = o.origen;
  if (o.peso) compressed.pe = o.peso;
  if (o.cajas) compressed.ca = o.cajas;
  if (o.venta) compressed.ve = o.venta;
  if (o.factura) compressed.fa = o.factura;
  if (o.facturado) compressed.fct = o.facturado;
  if (o.cajasFact) compressed.cf = o.cajasFact;
  if (o.pesoFact) compressed.pf = o.pesoFact;
  if (o.flete) compressed.fl = o.flete;
  if (o.provision) compressed.pr = o.provision;
  if (o.transportadora) compressed.tr = o.transportadora;
  if (o.placa) compressed.pl = o.placa;
  if (o.conductor) compressed.co = o.conductor;
  if (o.celular) compressed.ce = o.celular;
  if (o.estado && o.estado !== "Pendiente") compressed.es = o.estado;
  if (o.obs) compressed.ob = o.obs;
  if (o.anuladoMotivo) compressed.am = o.anuladoMotivo;
  return compressed;
};

const decompressOrderFromCloud = (c: any): Order => {
  if (c.cliente !== undefined || c.fechaIngreso !== undefined) {
    return {
      id: c.id || "",
      pv: c.pv || "",
      oc: c.oc || "",
      fechaIngreso: c.fechaIngreso || "",
      fechaSalida: c.fechaSalida || "",
      fechaEntrega: c.fechaEntrega || "",
      fechaFactura: c.fechaFactura || "",
      horaCita: c.horaCita || "",
      cliente: c.cliente || "",
      ciudad: c.ciudad || "",
      origen: c.origen || "ACOPI-YUMBO",
      peso: Number(c.peso) || 0,
      cajas: Number(c.cajas) || 0,
      venta: Number(c.venta) || 0,
      factura: c.factura || "",
      facturado: Number(c.facturado) || 0,
      cajasFact: Number(c.cajasFact) || 0,
      pesoFact: Number(c.pesoFact) || 0,
      flete: Number(c.flete) || 0,
      provision: c.provision || "",
      transportadora: c.transportadora || "",
      placa: c.placa || "",
      conductor: c.conductor || "",
      celular: c.celular || "",
      estado: (c.estado || "Pendiente") as any,
      obs: c.obs || "",
      anuladoMotivo: c.anuladoMotivo || ""
    };
  }
  return {
    id: c.id || "",
    pv: c.pv || "",
    oc: c.oc || "",
    fechaIngreso: c.fi || "",
    fechaSalida: c.fs || "",
    fechaEntrega: c.fe || "",
    fechaFactura: c.ff || "",
    horaCita: c.hc || "",
    cliente: c.cl || "",
    ciudad: c.ci || "",
    origen: c.or || "ACOPI-YUMBO",
    peso: Number(c.pe) || 0,
    cajas: Number(c.ca) || 0,
    venta: Number(c.ve) || 0,
    factura: c.fa || "",
    facturado: Number(c.fct) || 0,
    cajasFact: Number(c.cf) || 0,
    pesoFact: Number(c.pf) || 0,
    flete: Number(c.fl) || 0,
    provision: c.pr || "",
    transportadora: c.tr || "",
    placa: c.pl || "",
    conductor: c.co || "",
    celular: c.ce || "",
    estado: (c.es || "Pendiente") as any,
    obs: c.ob || "",
    anuladoMotivo: c.am || ""
  };
};

export default function App() {
  const isEmployeeMode = typeof window !== 'undefined' && (
    window.location.search.includes('tab=pedidoEmpleados') ||
    window.location.search.includes('modulo=pedidos') ||
    window.location.search.includes('modulo=empleados') ||
    window.location.search.includes('seccion=pedidos') ||
    window.location.search.includes('seccion=empleados')
  );

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return safeLocalStorage.getItem('erp_authenticated') === 'true';
  });
  const [loginEmail, setLoginEmail] = useState('auxiliarlogistico@latinproducts.com.co');
  const [loginPass, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Primary Collections
  const [orders, setOrders] = useState<Order[]>([]);
  const [deletedOrderIds, setDeletedOrderIds] = useState<Record<string, { physical: boolean; motivo?: string }>>(() => {
    const raw = safeLocalStorage.getItem('lp_deleted_orders');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return {};
      }
    }
    return {};
  });
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>(() => {
    const isEmployee = typeof window !== 'undefined' && (
      window.location.search.includes('tab=pedidoEmpleados') ||
      window.location.search.includes('modulo=pedidos') ||
      window.location.search.includes('modulo=empleados') ||
      window.location.search.includes('seccion=pedidos') ||
      window.location.search.includes('seccion=empleados')
    );
    return isEmployee ? 'pedidoEmpleados' : 'inicio';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Sidebar Category Expansion state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    return {
      operativos: false,
      entidades: false,
      control: false,
      inteligencia: false,
    };
  });

  // Global PDF parsing states for "Cargar PDF" universal uploader
  const [isPdfParsing, setIsPdfParsing] = useState<boolean>(false);
  const [pdfParsingError, setPdfParsingError] = useState<string | null>(null);
  const [parsedPdfData, setParsedPdfData] = useState<any | null>(null);
  const [pdfSelectedMatchOrderId, setPdfSelectedMatchOrderId] = useState<string>('');
  const [pSuccessToast, setPSuccessToast] = useState<{ title: string; message: string } | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  // Search & Filtering inside custom sub-tabs in App
  const [despachadoSearch, setDespachadoSearch] = useState('');
  const [despachadoPage, setDespachadoPage] = useState(1);
  const [pendienteSearch, setPendienteSearch] = useState('');
  const [pendientePage, setPendientePage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderFormClientSearch, setOrderFormClientSearch] = useState('');
  const [carrierPage, setCarrierPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);

  // Reset page when search term changes
  useEffect(() => {
    setDespachadoPage(1);
  }, [despachadoSearch]);

  useEffect(() => {
    setPendientePage(1);
  }, [pendienteSearch]);

  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch]);

  // Modals management
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null);

  // Custom entity Creation states
  const [isCarrierFormOpen, setIsCarrierFormOpen] = useState(false);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);

  // Cancellation Audit PIN Modal
  const [auditTargetId, setAuditTargetId] = useState<string | null>(null);
  const [auditPinInput, setAuditPinInput] = useState('');
  const [auditMotivo, setAuditMotivo] = useState('');
  const [auditError, setAuditError] = useState('');

  // Pre-populate data securely on first mount from Firebase (with localStorage or seed fallback)
  useEffect(() => {
    // 1. Fast offline local initialization
    const rawDeleted = safeLocalStorage.getItem('lp_deleted_orders');
    let initialDeleted: Record<string, { physical: boolean; motivo?: string }> = {};
    if (rawDeleted) {
      try {
        initialDeleted = JSON.parse(rawDeleted);
      } catch (e) {
        console.warn(e);
      }
    }

    const rawOrders = safeLocalStorage.getItem('lp_orders');
    const rawCarriers = safeLocalStorage.getItem('lp_carriers');
    const rawCustomers = safeLocalStorage.getItem('lp_customers');
    const rawNovedades = safeLocalStorage.getItem('lp_novedades');
    const rawReminders = safeLocalStorage.getItem('lp_reminders');

    let initialOrders = SEED_ORDERS;
    if (rawOrders) {
      try {
        const parsed = JSON.parse(rawOrders);
        if (Array.isArray(parsed)) initialOrders = parsed;
      } catch (e) {
        console.warn('Failing parsing orders:', e);
      }
    }

    // Filter/apply tombstones immediately to initialOrders
    if (Object.keys(initialDeleted).length > 0) {
      initialOrders = initialOrders.map((o: any) => {
        const delObj = initialDeleted[o.id];
        if (delObj) {
          if (delObj.physical) return null;
          return { ...o, estado: 'Anulado' as const, anuladoMotivo: delObj.motivo || '' };
        }
        return o;
      }).filter(Boolean) as Order[];
    }

    const migratedInitialOrders = initialOrders.map((o: any) => o.cliente === 'DISTRIBUIDORA EL VALLE EXPRESS' ? { ...o, cliente: 'INVERSIONES LA VAQUITA EXPRESS' } : o);
    setOrders(migratedInitialOrders);

    const parseJSONSafely = (str: string | null, fallback: any) => {
      if (!str) return fallback;
      try {
        return JSON.parse(str);
      } catch (e) {
        return fallback;
      }
    };

    const initialCarriers = parseJSONSafely(rawCarriers, SEED_CARRIERS);
    setCarriers(initialCarriers);

    const initialCustomers = parseJSONSafely(rawCustomers, SEED_CUSTOMERS);
    const migratedInitialCustomers = initialCustomers.map((c: any) => c.nombre === 'DISTRIBUIDORA EL VALLE EXPRESS' ? { ...c, nombre: 'INVERSIONES LA VAQUITA EXPRESS' } : c);
    setCustomers(migratedInitialCustomers);

    const initialNovedades = parseJSONSafely(rawNovedades, SEED_NOVEDADES);
    setNovedades(initialNovedades);

    const initialReminders = parseJSONSafely(rawReminders, SEED_REMINDERS);
    setReminders(initialReminders);

    // 2. Subscribe to real-time updates from Firebase Firestore for multi-user collaboration
    const unsubDeleted = subscribeToCloud('app_state', 'deleted_orders', (data) => {
      if (data && typeof data === 'object') {
        setDeletedOrderIds(data);
        safeLocalStorage.setItem('lp_deleted_orders', JSON.stringify(data));
        // Filter orders in real-time
        setOrders(prevOrders => {
          return prevOrders.map(o => {
            const delObj = data[o.id];
            if (delObj) {
              if (delObj.physical) return null;
              return { ...o, estado: 'Anulado' as const, anuladoMotivo: delObj.motivo || '' };
            }
            return o;
          }).filter(Boolean) as Order[];
        });
      }
    });

    const unsubOrders = subscribeToCloud('app_state', 'orders', (data) => {
      if (Array.isArray(data)) {
        // Decompress the orders list retrieved from the cloud
        const decompressed = data.map(decompressOrderFromCloud);

        // Load latest deleted map
        const rawDel = safeLocalStorage.getItem('lp_deleted_orders');
        let delMap: Record<string, { physical: boolean; motivo?: string }> = {};
        if (rawDel) {
          try { delMap = JSON.parse(rawDel); } catch (e) {}
        }

        let cleaned = decompressed.map((o: any) => o.cliente === 'DISTRIBUIDORA EL VALLE EXPRESS' ? { ...o, cliente: 'INVERSIONES LA VAQUITA EXPRESS' } : o);
        if (Object.keys(delMap).length > 0) {
          cleaned = cleaned.map(o => {
            const delObj = delMap[o.id];
            if (delObj) {
              if (delObj.physical) return null;
              return { ...o, estado: 'Anulado' as const, anuladoMotivo: delObj.motivo || '' };
            }
            return o;
          }).filter(Boolean) as Order[];
        }

        setOrders(cleaned);
        safeLocalStorage.setItem('lp_orders', JSON.stringify(cleaned));
      }
    });

    const unsubCarriers = subscribeToCloud('app_state', 'carriers', (data) => {
      if (Array.isArray(data)) {
        setCarriers(data);
        safeLocalStorage.setItem('lp_carriers', JSON.stringify(data));
      }
    });

    const unsubCustomers = subscribeToCloud('app_state', 'customers', (data) => {
      if (Array.isArray(data)) {
        const migrated = data.map((c: any) => c.nombre === 'DISTRIBUIDORA EL VALLE EXPRESS' ? { ...c, nombre: 'INVERSIONES LA VAQUITA EXPRESS' } : c);
        setCustomers(migrated);
        safeLocalStorage.setItem('lp_customers', JSON.stringify(migrated));
      }
    });

    const unsubNovedades = subscribeToCloud('app_state', 'novedades', (data) => {
      if (Array.isArray(data)) {
        setNovedades(data);
        safeLocalStorage.setItem('lp_novedades', JSON.stringify(data));
      }
    });

    const unsubReminders = subscribeToCloud('app_state', 'reminders', (data) => {
      if (Array.isArray(data)) {
        setReminders(data);
        safeLocalStorage.setItem('lp_reminders', JSON.stringify(data));
      }
    });

    return () => {
      unsubDeleted();
      unsubOrders();
      unsubCarriers();
      unsubCustomers();
      unsubNovedades();
      unsubReminders();
    };
  }, []);

  // Save changes wrapper
  const saveDeletedOrders = (updated: Record<string, { physical: boolean; motivo?: string }>) => {
    setDeletedOrderIds(updated);
    safeLocalStorage.setItem('lp_deleted_orders', JSON.stringify(updated));
    saveToCloud('app_state', 'deleted_orders', updated);
  };

  const saveOrders = (updated: Order[]) => {
    setOrders(updated);
    safeLocalStorage.setItem('lp_orders', JSON.stringify(updated));
    const compressed = updated.map(compressOrderForCloud);
    saveToCloud('app_state', 'orders', compressed);
  };
  const saveCarriers = (updated: Carrier[]) => {
    setCarriers(updated);
    safeLocalStorage.setItem('lp_carriers', JSON.stringify(updated));
    saveToCloud('app_state', 'carriers', updated);
  };
  const saveCustomers = (updated: Customer[]) => {
    setCustomers(updated);
    safeLocalStorage.setItem('lp_customers', JSON.stringify(updated));
    saveToCloud('app_state', 'customers', updated);
  };
  const saveNovedades = (updated: Novedad[]) => {
    setNovedades(updated);
    safeLocalStorage.setItem('lp_novedades', JSON.stringify(updated));
    saveToCloud('app_state', 'novedades', updated);
  };
  const saveReminders = (updated: Reminder[]) => {
    setReminders(updated);
    safeLocalStorage.setItem('lp_reminders', JSON.stringify(updated));
    saveToCloud('app_state', 'reminders', updated);
  };

  // Auth Submit Action
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail.trim() === 'auxiliarlogistico@latinproducts.com.co') {
      setIsAuthenticated(true);
      safeLocalStorage.setItem('erp_authenticated', 'true');
      setAuthError('');
    } else {
      setAuthError('🔑 Identificación de usuario no autorizada para el portal ejecutivo.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    safeLocalStorage.removeItem('erp_authenticated');
  };

  // Order CRUD
  const fillBillingDefaults = (o: Order): Order => {
    const requiresBilling = ['Despachado', 'En Sitio / Bodega', 'Entregado', 'Finalizado'].includes(o.estado);
    if (requiresBilling) {
      return {
        ...o,
        cajasFact: o.cajasFact && o.cajasFact > 0 ? o.cajasFact : o.cajas,
        pesoFact: o.pesoFact && o.pesoFact > 0 ? o.pesoFact : o.peso,
        facturado: o.facturado && o.facturado > 0 ? o.facturado : o.venta,
      };
    }
    return o;
  };

  const handleAddOrder = (newOrder: Order) => {
    const filled = fillBillingDefaults(newOrder);
    if (filled.pv && filled.pv.toString().trim() !== '') {
      const idx = orders.findIndex(o => o.pv && o.pv.toString().trim().toLowerCase() === filled.pv.toString().toLowerCase().trim());
      if (idx !== -1) {
        // Replace/overwrite existing
        const updated = [...orders];
        updated[idx] = {
          ...updated[idx],
          ...filled,
          id: updated[idx].id // Preserve ID
        };
        saveOrders(updated);
        setPSuccessToast({
          title: "ORDEN ACTUALIZADA",
          message: `La orden ${updated[idx].id} (PV: ${filled.pv}) ya existía y fue actualizada con los nuevos datos.`
        });
        setTimeout(() => setPSuccessToast(null), 5000);
        if (editingOrder && (editingOrder.id === filled.id || editingOrder.pv === filled.pv)) {
          setEditingOrder(null);
          setIsOrderFormOpen(false);
        }
        return;
      }
    }
    const updated = [filled, ...orders];
    saveOrders(updated);
    setPSuccessToast({
      title: "ORDEN CREADA CON ÉXITO",
      message: `La nueva orden ${filled.id} (PV: ${filled.pv || 'S/N'}) para ${filled.cliente} ha sido guardada en el sistema.`
    });
    setTimeout(() => setPSuccessToast(null), 5000);
    if (editingOrder && (editingOrder.id === filled.id || editingOrder.pv === filled.pv)) {
      setEditingOrder(null);
      setIsOrderFormOpen(false);
    }
  };

  const handleAddOrders = (newOrders: Order[]) => {
    const filled = newOrders.map(fillBillingDefaults);
    const updated = [...orders];
    
    filled.forEach(newO => {
      if (newO.pv && newO.pv.toString().trim() !== '') {
        const idx = updated.findIndex(o => o.pv && o.pv.toString().trim().toLowerCase() === newO.pv.toString().trim().toLowerCase());
        if (idx !== -1) {
          // Overwrite/update existing order
          const existing = updated[idx];
          updated[idx] = {
            ...existing,
            ...newO,
            id: existing.id, // Preserve ID
            // Preserve tracking elements in ERP if updated manually
            estado: existing.estado !== "Pendiente" ? existing.estado : newO.estado,
            placa: existing.placa || newO.placa,
            conductor: existing.conductor || newO.conductor,
            celular: existing.celular || newO.celular,
            fechaSalida: existing.fechaSalida || newO.fechaSalida,
            fechaEntrega: existing.fechaEntrega || newO.fechaEntrega
          };
        } else {
          updated.push(newO);
        }
      } else {
        updated.push(newO);
      }
    });
    
    saveOrders(updated);
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    const filled = fillBillingDefaults(updatedOrder);
    const updated = orders.map(o => o.id === filled.id ? filled : o);
    saveOrders(updated);
    setPSuccessToast({
      title: "CAMBIOS GUARDADOS",
      message: `La orden ${filled.id} (PV: ${filled.pv || 'S/N'}) se actualizó correctamente.`
    });
    setTimeout(() => setPSuccessToast(null), 5000);
    if (editingOrder && editingOrder.id === filled.id) {
      setEditingOrder(null);
      setIsOrderFormOpen(false);
    }
  };

  const triggerAuditCancellation = (id: string) => {
    setAuditTargetId(id);
    setAuditPinInput('');
    setAuditMotivo('');
    setAuditError('');
  };

  const handleConfirmCancellation = () => {
    if (auditPinInput !== DELETION_PIN) {
      setAuditError('❌ PIN de autorización inválido. Remítase al administrador.');
      return;
    }
    if (!auditMotivo.trim()) {
      setAuditError('❌ El motivo de anulación es de carácter contractual y obligatorio.');
      return;
    }

    if (auditTargetId) {
      const updatedDeleted = {
        ...deletedOrderIds,
        [auditTargetId]: { physical: false, motivo: auditMotivo.trim() }
      };
      saveDeletedOrders(updatedDeleted);
    }

    const updated = orders.map(o => {
      if (o.id === auditTargetId) {
        return {
          ...o,
          estado: 'Anulado' as const,
          anuladoMotivo: auditMotivo.trim()
        };
      }
      return o;
    });

    saveOrders(updated);
    setAuditTargetId(null);
  };

  const onDeleteOrder = (id: string, pin: string, motivo: string, physical?: boolean): boolean => {
    if (pin !== DELETION_PIN) {
      return false;
    }

    const updatedDeleted = {
      ...deletedOrderIds,
      [id]: { physical: !!physical, motivo }
    };
    saveDeletedOrders(updatedDeleted);

    let updated;
    if (physical) {
      updated = orders.filter(o => o.id !== id);
    } else {
      updated = orders.map(o => o.id === id ? { ...o, estado: 'Anulado' as const, anuladoMotivo: motivo } : o);
    }
    saveOrders(updated);
    return true;
  };

  const handleDeleteImportedOrders = () => {
    const updated = orders.filter(o => {
      const obsLower = o.obs?.toLowerCase() || '';
      const isImported = obsLower.includes("importado") || 
                         o.id.startsWith("SOL-2") || 
                         o.id.startsWith("SOL-3") || 
                         o.id.startsWith("SOL-4");
      return !isImported;
    });
    saveOrders(updated);
  };

  const handleResetDatabase = () => {
    saveDeletedOrders({});
    saveOrders(SEED_ORDERS);
    saveCarriers(SEED_CARRIERS);
    saveCustomers(SEED_CUSTOMERS);
    saveNovedades(SEED_NOVEDADES);
    saveReminders(SEED_REMINDERS);
  };

  const pdfMatchingOrder = useMemo(() => {
    if (!parsedPdfData || parsedPdfData.tipoDocumento !== 'FACTURA_PROVISION') return null;
    return orders.find(o => 
      o.estado !== 'Anulado' && 
      ((parsedPdfData.oc && o.oc === parsedPdfData.oc) || 
       (parsedPdfData.pv && o.pv === parsedPdfData.pv))
    ) || null;
  }, [parsedPdfData, orders]);

  const processPdfFile = (file: File) => {
    setIsPdfParsing(true);
    setPdfParsingError(null);
    setParsedPdfData(null);
    setPdfSelectedMatchOrderId('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = (e.target?.result as string).split(',')[1];
        const response = await fetch('/api/gemini/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64Data,
            fileType: file.type || 'application/pdf',
          }),
        });

        const responseText = await response.text();
        let parsedData: any = null;
        try {
          parsedData = JSON.parse(responseText);
        } catch (jsonErr) {
          // Response is not JSON (e.g. it is HTML from Express or proxy)
          let errMsg = `Error del Servidor (${response.status})`;
          const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
          const bodyMatch = responseText.match(/<pre>(.*?)<\/pre>/i);
          const h1Match = responseText.match(/<h1>(.*?)<\/h1>/i);
          if (titleMatch) {
            errMsg += `: ${titleMatch[1]}`;
            if (bodyMatch) errMsg += ` - ${bodyMatch[1]}`;
            else if (h1Match) errMsg += ` - ${h1Match[1]}`;
          } else if (h1Match) {
            errMsg += `: ${h1Match[1]}`;
          } else {
            errMsg += `: ${responseText.slice(0, 200)}`;
          }
          throw new Error(errMsg);
        }

        if (!response.ok) {
          throw new Error(parsedData.error || `Error del Servidor (${response.status})`);
        }

        setParsedPdfData(parsedData);
      } catch (err: any) {
        console.error('Error parsing PDF:', err);
        setPdfParsingError(err.message || 'Error al conectar con el servidor de análisis inteligente.');
      } finally {
        setIsPdfParsing(false);
      }
    };

    reader.onerror = () => {
      setPdfParsingError('Error físico al leer el archivo seleccionado.');
      setIsPdfParsing(false);
    };

    reader.readAsDataURL(file);
  };

  const resolveCustomerFromPdf = (rawName: string) => {
    if (!rawName) return "ALMACENES ÉXITO S.A.";
    const validCustomers = customers.map(c => c.nombre);
    const norm = rawName.toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[.\-,()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (validCustomers.length === 0) return rawName;

    // 1. First try standard exact matching
    for (const c of validCustomers) {
      const cNorm = c.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\-,()]/g, ' ').replace(/\s+/g, ' ').trim();
      if (norm === cNorm) return c;
    }

    // 2. Specific guard: If raw name contains "MERCAPAVA", find a valid customer containing "MERCAPAVA"
    if (norm.includes("MERCAPAVA")) {
      for (const c of validCustomers) {
        const cNorm = c.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\-,()]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cNorm.includes("MERCAPAVA")) {
          const rawWords = norm.split(/\s+/);
          const branchCode = rawWords.find(w => /^\d+$/.test(w) || w.startsWith("0"));
          if (branchCode && cNorm.includes(branchCode)) {
            return c;
          }
        }
      }
      for (const c of validCustomers) {
        if (c.toUpperCase().includes("MERCAPAVA")) return c;
      }
    }

    // 3. Try standard major brand mappings
    for (const c of validCustomers) {
      const cNorm = c.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\-,()]/g, ' ');
      if (norm.includes("EXITO") && c.toUpperCase().includes("EXITO")) return c;
      if (norm.includes("JUMBO") && c.toUpperCase().includes("JUMBO")) return c;
      if (norm.includes("CENCOSUD") && c.toUpperCase().includes("JUMBO")) return c;
      if (!norm.includes("MERCAPAVA") && norm.includes("ALKOSTO") && c.toUpperCase().includes("ALKOSTO")) return c;
      if (norm.includes("OLIMPICA") && c.toUpperCase().includes("OLIMPICA")) return c;
      if (norm.includes("VALLE") && c.toUpperCase().includes("VALLE")) return c;
      if (norm.includes("CANAVERAL") && c.toUpperCase().includes("CANAVERAL")) return c;
      if (norm.includes("PACIFICO") && c.toUpperCase().includes("PACIFICO")) return c;
      if (norm.includes("HUILA") && c.toUpperCase().includes("HUILA")) return c;
      if (norm.includes("MERCACENTRO") && c.toUpperCase().includes("MERCACENTRO")) return c;
    }

    // Fallback search
    for (const c of validCustomers) {
      const cNorm = c.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\-,()]/g, ' ');
      const words = norm.split(/\s+/).filter(w => w.length > 2);
      if (words.some(w => cNorm.includes(w))) return c;
    }

    return rawName;
  };

  const handleCreateOrderFromPdf = () => {
    if (!parsedPdfData) return;
    
    // Dynamically calculate the next distinct SOLAR ID to avoid conflicts
    const maxNumericId = orders.reduce((max, o) => {
      const num = parseInt(o.id.replace('SOL-', ''));
      return isNaN(num) ? max : Math.max(max, num);
    }, 1000);
    const newId = `SOL-${maxNumericId + 1}`;

    const newOrder: Order = {
      id: newId,
      pv: parsedPdfData.pv || "",
      oc: parsedPdfData.oc || "",
      fechaIngreso: new Date().toISOString().split('T')[0],
      fechaSalida: "",
      fechaEntrega: "",
      fechaFactura: "",
      horaCita: "",
      cliente: resolveCustomerFromPdf(parsedPdfData.cliente),
      ciudad: parsedPdfData.ciudad || "Medellín",
      origen: "ACOPI-YUMBO",
      peso: parseFloat(parsedPdfData.peso) || 0,
      cajas: parseFloat(parsedPdfData.cajas) || 0,
      venta: parseFloat(parsedPdfData.venta) || 0,
      factura: parsedPdfData.factura || "",
      facturado: parseFloat(parsedPdfData.venta) || 0,
      cajasFact: parseFloat(parsedPdfData.cajas) || 0,
      pesoFact: parseFloat(parsedPdfData.peso) || 0,
      flete: parseFloat(parsedPdfData.flete) || 0,
      provision: parsedPdfData.provision || "",
      transportadora: parsedPdfData.transportadora || carriers[0]?.nombre || "SISA CARGO",
      placa: "",
      conductor: "",
      celular: "",
      estado: "Pendiente",
      obs: "Creado automáticamente desde escaneo inteligente de Pedido Cliente."
    };

    // Save the order to system immediately so it's guaranteed to be saved
    handleAddOrder(newOrder);

    // Open detailed control modal so they can review and add details if needed
    setEditingOrder({
      ...newOrder,
      facturado: newOrder.facturado || 0,
      cajasFact: newOrder.cajasFact || 0,
      pesoFact: newOrder.pesoFact || 0,
    });
    setIsOrderFormOpen(true);
    setParsedPdfData(null);
  };

  const handleUpdateOrderFromProvisionPdf = () => {
    if (!parsedPdfData) return;
    const targetOrderId = pdfSelectedMatchOrderId || (pdfMatchingOrder ? pdfMatchingOrder.id : '');
    if (!targetOrderId) return;

    const existing = orders.find(o => o.id === targetOrderId);
    if (existing) {
      const fleteVal = parseFloat(parsedPdfData.flete) || 0;
      handleUpdateOrder({
        ...existing,
        provision: parsedPdfData.provision || existing.provision,
        flete: fleteVal || existing.flete,
        transportadora: parsedPdfData.transportadora || existing.transportadora,
        obs: `${existing.obs || ''} | Prov. Flete IA: ${parsedPdfData.provision || 'S/N'} por $${(fleteVal || 0).toLocaleString('es-CO')}`.slice(0, 300)
      });
      
      setPSuccessToast({
        title: "PROVISIÓN ASOCIADA CON ÉXITO",
        message: `Se vinculó la provisión flete ${parsedPdfData.provision || 'S/N'} ($${fleteVal.toLocaleString('es-CO')}) a la orden ${existing.id}.`
      });
      setTimeout(() => setPSuccessToast(null), 6000);
    }
    setParsedPdfData(null);
    setPdfSelectedMatchOrderId('');
  };

  const handleOpenOrderForm = (order?: Order) => {
    setOrderFormClientSearch('');
    if (order) {
      setEditingOrder({
        ...order,
        transportadora: order.estado === 'Pendiente' ? '' : order.transportadora,
        facturado: order.facturado || 0,
        cajasFact: order.cajasFact || 0,
        pesoFact: order.pesoFact || 0,
      });
    } else {
      // Setup blank pre-filled order
      const maxNumericId = orders.reduce((max, o) => {
        const num = parseInt(o.id.replace('SOL-', ''));
        return isNaN(num) ? max : Math.max(max, num);
      }, 1000);
      const newId = `SOL-${maxNumericId + 1}`;

      setEditingOrder({
        id: newId,
        pv: "",
        oc: "",
        fechaIngreso: new Date().toISOString().split('T')[0],
        fechaSalida: "",
        fechaEntrega: "",
        fechaFactura: "",
        horaCita: "",
        cliente: customers[0]?.nombre || "",
        ciudad: customers[0]?.ciudad || "",
        origen: "ACOPI-YUMBO",
        peso: 0,
        cajas: 0,
        venta: 0,
        factura: "",
        facturado: 0,
        cajasFact: 0,
        pesoFact: 0,
        flete: 0,
        provision: "",
        transportadora: "",
        placa: "",
        conductor: "",
        celular: "",
        estado: "Pendiente",
        obs: ""
      });
    }
    setIsOrderFormOpen(true);
  };

  // Carrier form state helper
  const [carrierName, setCarrierName] = useState('');
  const [carrierNit, setCarrierNit] = useState('');
  const [carrierSede, setCarrierSede] = useState('');
  const [carrierDir, setCarrierDir] = useState('');
  const [carrierCont, setCarrierCont] = useState('');
  const [carrierTel, setCarrierTel] = useState('');
  const [carrierMail, setCarrierMail] = useState('');
  const [carrierCost, setCarrierCost] = useState(0);

  const handleOpenCarrierForm = (id?: string) => {
    if (id) {
      const match = carriers.find(c => c.id === id);
      if (match) {
        setEditingCarrierId(id);
        setCarrierName(match.nombre);
        setCarrierNit(match.nit);
        setCarrierSede(match.ciudad);
        setCarrierDir(match.dir);
        setCarrierCont(match.contacto);
        setCarrierTel(match.tel);
        setCarrierMail(match.correo);
        setCarrierCost(match.costoSugerido);
      }
    } else {
      setEditingCarrierId(null);
      setCarrierName('');
      setCarrierNit('');
      setCarrierSede('');
      setCarrierDir('');
      setCarrierCont('');
      setCarrierTel('');
      setCarrierMail('');
      setCarrierCost(0);
    }
    setIsCarrierFormOpen(true);
  };

  const handleSaveCarrier = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCarrierId) {
      const updated = carriers.map(c => c.id === editingCarrierId ? {
        ...c,
        nombre: carrierName,
        nit: carrierNit,
        ciudad: carrierSede,
        dir: carrierDir,
        contacto: carrierCont,
        tel: carrierTel,
        correo: carrierMail,
        costoSugerido: carrierCost
      } : c);
      saveCarriers(updated);
    } else {
      const nextId = `CARR-0${carriers.length + 1}`;
      const updated = [...carriers, {
        id: nextId,
        nombre: carrierName,
        nit: carrierNit,
        ciudad: carrierSede,
        dir: carrierDir,
        contacto: carrierCont,
        tel: carrierTel,
        correo: carrierMail,
        costoSugerido: carrierCost
      }];
      saveCarriers(updated);
    }
    setIsCarrierFormOpen(false);
  };

  // Customer Form state helper
  const [custName, setCustName] = useState('');
  const [custCiudad, setCustCiudad] = useState('');
  const [custNit, setCustNit] = useState('');
  const [custDir, setCustDir] = useState('');
  const [custCont, setCustCont] = useState('');
  const [custCel, setCustCel] = useState('');
  const [custFijo, setCustFijo] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custMalla, setCustMalla] = useState('');
  const [custCita, setCustCita] = useState<'SI' | 'NO'>('NO');
  const [custZona, setCustZona] = useState('');
  const [custObs, setCustObs] = useState('');

  const handleOpenCustomerForm = (id?: string) => {
    if (id) {
      const match = customers.find(c => c.id === id);
      if (match) {
        setEditingCustomerId(id);
        setCustName(match.nombre);
        setCustCiudad(match.ciudad);
        setCustNit(match.nit);
        setCustDir(match.dir);
        setCustCont(match.contacto);
        setCustCel(match.celular);
        setCustFijo(match.fijo);
        setCustEmail(match.email);
        setCustMalla(match.malla);
        setCustCita(match.cita);
        setCustZona(match.zona);
        setCustObs(match.obs);
      }
    } else {
      setEditingCustomerId(null);
      setCustName('');
      setCustCiudad('');
      setCustNit('');
      setCustDir('');
      setCustCont('');
      setCustCel('');
      setCustFijo('');
      setCustEmail('');
      setCustMalla('');
      setCustCita('NO');
      setCustZona('');
      setCustObs('');
    }
    setIsCustomerFormOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomerId) {
      const updated = customers.map(c => c.id === editingCustomerId ? {
        ...c,
        nombre: custName,
        ciudad: custCiudad,
        nit: custNit,
        dir: custDir,
        contacto: custCont,
        celular: custCel,
        fijo: custFijo,
        email: custEmail,
        malla: custMalla,
        cita: custCita,
        zona: custZona,
        obs: custObs
      } : c);
      saveCustomers(updated);
    } else {
      const nextId = `CUST-${10 + customers.length + 1}`;
      const updated = [...customers, {
        id: nextId,
        nombre: custName,
        ciudad: custCiudad,
        nit: custNit,
        dir: custDir,
        contacto: custCont,
        celular: custCel,
        fijo: custFijo,
        email: custEmail,
        malla: custMalla,
        cita: custCita,
        zona: custZona,
        obs: custObs
      }];
      saveCustomers(updated);
    }
    setIsCustomerFormOpen(false);
  };

  // Custom calculated statistics for App.tsx pages representation
  const despachadosList = useMemo(() => {
    return orders.filter(o => o.estado === 'Despachado' || o.estado === 'Entregado' || o.estado === 'Finalizado');
  }, [orders]);

  const filteredDespachados = useMemo(() => {
    if (!despachadoSearch.trim()) return despachadosList;
    const term = despachadoSearch.toLowerCase();
    return despachadosList.filter(o => 
      o.id.toLowerCase().includes(term) ||
      o.pv.toLowerCase().includes(term) ||
      o.cliente.toLowerCase().includes(term) ||
      o.ciudad.toLowerCase().includes(term) ||
      (o.placa && o.placa.toLowerCase().includes(term))
    );
  }, [despachadosList, despachadoSearch]);

  const paginatedDespachados = useMemo(() => {
    const startIndex = (despachadoPage - 1) * 12;
    return filteredDespachados.slice(startIndex, startIndex + 12);
  }, [filteredDespachados, despachadoPage]);

  const totalDespachadosPages = useMemo(() => {
    return Math.ceil(filteredDespachados.length / 12) || 1;
  }, [filteredDespachados]);

  const pendientesList = useMemo(() => {
    return orders.filter(o => o.estado === 'Pendiente' || o.estado === 'En Cargue');
  }, [orders]);

  const filteredPendientes = useMemo(() => {
    if (!pendienteSearch.trim()) return pendientesList;
    const term = pendienteSearch.toLowerCase();
    return pendientesList.filter(o => 
      o.id.toLowerCase().includes(term) ||
      o.cliente.toLowerCase().includes(term) ||
      o.ciudad.toLowerCase().includes(term)
    );
  }, [pendientesList, pendienteSearch]);

  const paginatedPendientes = useMemo(() => {
    const startIndex = (pendientePage - 1) * 12;
    return filteredPendientes.slice(startIndex, startIndex + 12);
  }, [filteredPendientes, pendientePage]);

  const totalPendientesPages = useMemo(() => {
    return Math.ceil(filteredPendientes.length / 12) || 1;
  }, [filteredPendientes]);

  const paginatedCarriers = useMemo(() => {
    const startIndex = (carrierPage - 1) * 12;
    return carriers.slice(startIndex, startIndex + 12);
  }, [carriers, carrierPage]);

  const totalCarriersPages = useMemo(() => {
    return Math.ceil(carriers.length / 12) || 1;
  }, [carriers]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const term = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.nombre.toLowerCase().includes(term) ||
      (c.nit?.toLowerCase() || "").includes(term) ||
      (c.ciudad?.toLowerCase() || "").includes(term) ||
      (c.contacto?.toLowerCase() || "").includes(term) ||
      (c.malla?.toLowerCase() || "").includes(term)
    );
  }, [customers, customerSearch]);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (customerPage - 1) * 8;
    return filteredCustomers.slice(startIndex, startIndex + 8);
  }, [filteredCustomers, customerPage]);

  const totalCustomersPages = useMemo(() => {
    return Math.ceil(filteredCustomers.length / 8) || 1;
  }, [filteredCustomers]);

  // Excel Excel generic export helper using SheetJS (XLSX)
  const handleExportToExcel = (headers: string[], rows: any[][], fileName: string) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, fileName);
  };

  const exportDespachadosToExcel = () => {
    const headers = [
      "Flete ID", "PV", "Cliente", "Destino", "Socio Operador", "Placa", "Factura N", 
      "Cajas Facturadas", "Cajas Solicitadas", "Peso Facturado (kg)", "Peso Solicitado (kg)", 
      "Valor Facturado", "Valor Solicitado", "% Flete s/ Fact", "Flete Valor", "Estado"
    ];
    const rows = filteredDespachados.map(o => {
      const actualVal = o.facturado && o.facturado > 0 ? o.facturado : o.venta;
      const pct = actualVal > 0 ? Number(((o.flete / actualVal) * 100).toFixed(2)) : 0;
      return [
        o.id,
        o.pv,
        o.cliente,
        o.ciudad,
        o.transportadora,
        o.placa || '',
        o.factura || '',
        o.cajasFact || o.cajas,
        o.cajas,
        o.pesoFact || o.peso,
        o.peso,
        o.facturado || o.venta,
        o.venta,
        pct,
        o.flete,
        o.estado
      ];
    });
    handleExportToExcel(
      headers,
      rows,
      `despachos_latinproducts_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const exportPendientesToExcel = () => {
    const headers = ["Flete ID", "Cliente Solicitante", "Localidad", "Cajas", "Peso (kg)", "Valor Comercial", "Estado"];
    const rows = filteredPendientes.map(o => [
      o.id,
      o.cliente,
      o.ciudad,
      o.cajas,
      o.peso,
      o.venta,
      o.estado
    ]);
    handleExportToExcel(
      headers,
      rows,
      `pendientes_latinproducts_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const exportCarriersToExcel = () => {
    const headers = ["NIT", "Socio Operador", "Sede Central", "Dirección", "Canal Contacto", "Celular/Tel", "Correo", "Tarifa Sugerida"];
    const rows = carriers.map(c => [
      c.nit || '',
      c.nombre,
      c.ciudad,
      c.dir || '',
      c.contacto || '',
      c.tel || '',
      c.correo || '',
      c.costoSugerido
    ]);
    handleExportToExcel(
      headers,
      rows,
      `socios_operadores_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const exportCustomersToExcel = () => {
    const headers = ["Razón Social", "NIT", "Dirección Exacta", "Ciudad", "Contacto", "Celular", "Malla Entrega", "Requiere Cita"];
    const rows = customers.map(c => [
      c.nombre,
      c.nit || '',
      c.dir || '',
      c.ciudad || '',
      c.contacto || '',
      c.celular || '',
      c.malla || '',
      c.cita || 'NO'
    ]);
    handleExportToExcel(
      headers,
      rows,
      `clientes_latinproducts_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const handleUniversalExcelExport = () => {
    const today = new Date().toISOString().split('T')[0];

    if (activeTab === 'inicio') {
      // Export all collections to a multi-sheet Excel file
      const wb = XLSX.utils.book_new();

      // Sheet 1: Solicitudes
      const ordersHeaders = [
        "Código", "PV", "OC", "Ingreso", "Cliente", "Ciudad", "Estado", "Flete", 
        "Transportadora", "VentaOriginal", "CajasOriginal", "PesoOriginal", 
        "VentaFacturado", "CajasFacturado", "PesoFacturado", "FacturaSocio", "Provisión"
      ];
      const ordersRows = orders.map(o => [
        o.id, o.pv, o.oc, o.fechaIngreso, o.cliente, o.ciudad, o.estado, o.flete,
        o.transportadora, o.venta, o.cajas, o.peso, o.facturado || o.venta,
        o.cajasFact || o.cajas, o.pesoFact || o.peso, o.factura || '', o.provision || ''
      ]);
      const wsOrders = XLSX.utils.aoa_to_sheet([ordersHeaders, ...ordersRows]);
      XLSX.utils.book_append_sheet(wb, wsOrders, "Solicitudes Fletes");

      // Sheet 2: Socios Operadores
      const carrierHeaders = ["NIT", "Socio Operador", "Sede Central", "Dirección", "Canal Contacto", "Celular/Tel", "Correo", "Tarifa Sugerida"];
      const carrierRows = carriers.map(c => [
        c.nit || '', c.nombre, c.ciudad, c.dir || '', c.contacto || '', c.tel || '', c.correo || '', c.costoSugerido
      ]);
      const wsCarriers = XLSX.utils.aoa_to_sheet([carrierHeaders, ...carrierRows]);
      XLSX.utils.book_append_sheet(wb, wsCarriers, "Socios Operadores");

      // Sheet 3: Clientes
      const customerHeaders = ["Razón Social", "NIT", "Dirección Exacta", "Ciudad", "Contacto", "Celular", "Malla Entrega", "Requiere Cita"];
      const customerRows = customers.map(c => [
        c.nombre, c.nit || '', c.dir || '', c.ciudad || '', c.contacto || '', c.celular || '', c.malla || '', c.cita || 'NO'
      ]);
      const wsCustomers = XLSX.utils.aoa_to_sheet([customerHeaders, ...customerRows]);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Clientes");

      XLSX.writeFile(wb, `master_latinproducts_${today}.xlsx`);
    } else if (activeTab === 'facturacion') {
      const headers = [
        "Código", "PV", "OC", "Ingreso", "Cliente", "Ciudad", "Estado", "Flete", 
        "Transportadora", "VentaOriginal", "CajasOriginal", "PesoOriginal", 
        "VentaFacturado", "CajasFacturado", "PesoFacturado", "FacturaSocio", "Provisión"
      ];
      const rows = orders.map(o => [
        o.id, o.pv, o.oc, o.fechaIngreso, o.cliente, o.ciudad, o.estado, o.flete,
        o.transportadora, o.venta, o.cajas, o.peso, o.facturado || o.venta,
        o.cajasFact || o.cajas, o.pesoFact || o.peso, o.factura || '', o.provision || ''
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
      XLSX.writeFile(wb, `solicitudes_latinproducts_${today}.xlsx`);
    } else if (activeTab === 'despachado') {
      exportDespachadosToExcel();
    } else if (activeTab === 'pendiente') {
      exportPendientesToExcel();
    } else if (activeTab === 'vehiculos') {
      const activeAssignments = orders.filter(o => o.estado !== 'Anulado' && o.placa);
      const headers = ["Identidad Orden", "Placa", "Conductor", "Celular", "Transportadora", "Destino", "Masa (kg)", "Categoría"];
      const rows = activeAssignments.map(o => {
        const size = o.peso <= 5000 ? "Turbo" :
                      o.peso > 5000 && o.peso <= 6500 ? "Liviano" :
                      o.peso > 6500 && o.peso <= 10000 ? "Sencillo" :
                      o.peso > 10000 && o.peso <= 18000 ? "Mula" : "Patineta";
        return [o.id, o.placa || '', o.conductor || '', o.celular || '', o.transportadora || '', o.ciudad || '', o.peso, size];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Censo de Flota");
      XLSX.writeFile(wb, `censo_de_flota_${today}.xlsx`);
    } else if (activeTab === 'transportadoras') {
      exportCarriersToExcel();
    } else if (activeTab === 'clientes') {
      exportCustomersToExcel();
    } else if (activeTab === 'provision') {
      const filteredForProvision = orders.filter(o => o.estado === 'Despachado' || o.estado === 'Entregado' || o.estado === 'Finalizado');
      const headers = ["Flete ID", "Cliente", "Socio Transportador", "Destino", "Costo Flete", "Factura Provisión (FP)"];
      const rows = filteredForProvision.map(o => [
        o.id, o.cliente, o.transportadora, o.ciudad, o.flete, o.provision || ''
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Auditoría Provisiones");
      XLSX.writeFile(wb, `auditoria_provisiones_${today}.xlsx`);
    } else if (activeTab === 'diferencias') {
      const differenceItems = orders.filter(o => 
        (o.estado === 'Entregado' || o.estado === 'Finalizado' || o.estado === 'Despachado') && 
        ((o.facturado >= 0 && o.facturado < o.venta) || (o.cajasFact >= 0 && o.cajasFact < o.cajas) || (o.pesoFact >= 0 && o.pesoFact < o.peso))
      );
      const headers = ["Flete ID", "Cliente", "Unidades Vendidas", "Unidades Facturadas", "Cajas Rechazadas", "Peso Rechazado", "Pérdida Comercial"];
      const rows = differenceItems.map(o => {
        const devVal = o.venta - (o.facturado > 0 ? o.facturado : o.venta);
        const devCj = o.cajas - (o.cajasFact > 0 ? o.cajasFact : o.cajas);
        const devKg = o.peso - (o.pesoFact > 0 ? o.pesoFact : o.peso);
        return [o.id, o.cliente, o.cajas, o.cajasFact || o.cajas, devCj, devKg, devVal];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Auditoría Averías");
      XLSX.writeFile(wb, `auditoria_averias_${today}.xlsx`);
    } else {
      // Default fallback
      const wb = XLSX.utils.book_new();
      const ordersHeaders = ["Código", "PV", "OC", "Cliente", "Ciudad", "Estado", "Flete"];
      const ordersRows = orders.map(o => [o.id, o.pv, o.oc, o.cliente, o.ciudad, o.estado, o.flete]);
      const wsOrders = XLSX.utils.aoa_to_sheet([ordersHeaders, ...ordersRows]);
      XLSX.utils.book_append_sheet(wb, wsOrders, "Resumen Fletes");
      XLSX.writeFile(wb, `export_general_${today}.xlsx`);
    }
  };

  const activeTracking = useMemo(() => {
    return orders.filter(o => o.estado === 'Despachado' || o.estado === 'En Cargue');
  }, [orders]);

  // Helpers for customer Malla checkboxes
  const isMallaDaySelected = (dayName: string): boolean => {
    return custMalla.split(',').map((s: string) => s.trim().toLowerCase()).includes(dayName.toLowerCase());
  };

  const toggleMallaDay = (dayName: string): void => {
    const list = custMalla.split(',').map((s: string) => s.trim()).filter(Boolean);
    const index = list.findIndex((s: string) => s.toLowerCase() === dayName.toLowerCase());
    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.push(dayName);
    }
    setCustMalla(list.join(', '));
  };

  const handleUpdateEditingOrderField = (field: keyof Order, value: any) => {
    if (!editingOrder) return;
    const nextOrder = { ...editingOrder, [field]: value };

    const isFredyCarrier = (name: string | undefined | null) => {
      if (!name) return false;
      const upper = name.toUpperCase();
      return upper.includes("FREDY") && (upper.includes("HERNANDEZ") || upper.includes("HERNÁNDEZ"));
    };

    const isDispatched = ['Despachado', 'En Sitio / Bodega', 'Entregado', 'Finalizado'].includes(editingOrder.estado);

    if (!isDispatched) {
      // When the carrier (transportadora) is modified, set flete:
      if (field === 'transportadora') {
        const isFredy = isFredyCarrier(value);
        if (isFredy) {
          const vFact = Number(nextOrder.facturado) > 0 ? Number(nextOrder.facturado) : Number(nextOrder.venta || 0);
          const cFact = Number(nextOrder.cajasFact) > 0 ? Number(nextOrder.cajasFact) : Number(nextOrder.cajas || 0);
          nextOrder.flete = Math.round((vFact * 0.035) + (cFact * 400));
        } else {
          const matched = carriers.find(c => c.nombre === value);
          if (matched) {
            nextOrder.flete = matched.costoSugerido || 0;
          }
        }
      } else {
        const isFredy = isFredyCarrier(nextOrder.transportadora);
        if (isFredy) {
          // If relevant fields for Fredy Hernandez change, automatically recalculate flete:
          if (['facturado', 'cajasFact', 'venta', 'cajas'].includes(field as string)) {
            const vFact = Number(nextOrder.facturado) > 0 ? Number(nextOrder.facturado) : Number(nextOrder.venta || 0);
            const cFact = Number(nextOrder.cajasFact) > 0 ? Number(nextOrder.cajasFact) : Number(nextOrder.cajas || 0);
            nextOrder.flete = Math.round((vFact * 0.035) + (cFact * 400));
          }
        }
      }
    }
    setEditingOrder(nextOrder);
  };

  return (
    <div className="min-h-screen bg-hud-bg text-slate-100 flex overflow-hidden">
      
      {/* ⚠️ Auth Gateway Portal Overlay */}
      {!isAuthenticated && !isEmployeeMode ? (
        <div className="fixed inset-0 bg-hud-bg/95 flex items-center justify-center p-4 z-[99999]">
          <div className="bg-hud-card border-2 border-hud-accent rounded-2xl w-full max-w-md p-8 shadow-2xl relative overflow-hidden">
            
            {/* Hologram aesthetic lines */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-hud-accent/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="text-center space-y-4 mb-8">
              <div className="inline-block bg-hud-accent/10 p-3 rounded-full border border-hud-accent/35">
                <Lock className="w-8 h-8 text-hud-accent pulse-led" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-display font-extrabold text-white tracking-widest uppercase">CONTROL DE ACCESO SEGURO</h2>
                <p className="text-[10px] text-hud-accent font-mono tracking-widest uppercase">LATIN PRODUCTS SAS | DIVISIÓN LOGÍSTICA</p>
              </div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-5 text-xs font-mono">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Identificador de Usuario</label>
                <input 
                  type="email" 
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="bg-slate-950 border border-hud-accent/25 focus:border-hud-accent/80 text-white rounded-lg p-3 w-full outline-none uppercase font-bold text-[11px] tracking-wide"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider font-mono">Clave de Acceso Encriptada</label>
                <input 
                  type="password" 
                  required
                  value={loginPass}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-950 border border-hud-accent/25 focus:border-hud-accent/80 text-white rounded-lg p-3 w-full outline-none"
                />
              </div>

              {authError && (
                <p className="text-rose-500 font-bold text-[10px] bg-rose-500/10 p-2.5 rounded border border-rose-500/25">
                  {authError}
                </p>
              )}

              <button 
                type="submit"
                className="bg-hud-accent text-slate-950 w-full py-3.5 rounded-xl font-display font-black tracking-widest text-xs uppercase cursor-pointer hover:bg-hud-accent/80 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Autenticar Sesión Segura
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Main Structural Drawer Sidebar */}
      {!isEmployeeMode && (
      <aside className={`bg-hud-card border-r border-hud-border/50 ${sidebarOpen ? 'w-64' : 'w-0 -translate-x-full md:w-16 md:translate-x-0'} shrink-0 z-40 transition-all duration-300 flex flex-col justify-between print:hidden`}>
        <div className="overflow-y-auto flex-1 py-6 px-4 space-y-6">
          
          {/* Logo brand */}
          <div className="flex items-center gap-3 pb-4 border-b border-sky-950/60">
            <div className="bg-hud-accent/10 p-2 rounded-lg border border-hud-accent/25">
              <Truck className="w-6 h-6 text-hud-accent pulse-led" />
            </div>
            {sidebarOpen && (
              <div className="space-y-0.5">
                <div className="font-display font-black text-xs text-white tracking-widest uppercase">LATIN PRODUCTS</div>
                <div className="text-[9px] text-[#476a8a] font-mono tracking-wider font-extrabold uppercase">División Logística</div>
              </div>
            )}
          </div>

          {/* Tab Navigation Categories */}
          <div className="space-y-4">
            
            {/* Category: Módulos Operativos */}
            <div className="space-y-1.5">
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => setExpandedCategories(prev => ({ ...prev, operativos: !prev.operativos }))}
                  className="w-full flex items-center justify-between text-[11px] font-mono font-black text-slate-100 hover:text-white tracking-widest uppercase px-3 py-2 text-left cursor-pointer select-none transition-colors border-b border-slate-800/80 mb-1"
                >
                  <span>Módulos Operativos</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${expandedCategories.operativos ? 'rotate-0' : '-rotate-90'}`} />
                </button>
              ) : null}
              {(!sidebarOpen || expandedCategories.operativos) && (
                <div className="space-y-0.5 font-mono text-[11px] font-medium">
                  <button 
                    onClick={() => setActiveTab('inicio')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'inicio' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Home className="w-4 h-4" />
                    {sidebarOpen && <span>Inicio</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('facturacion')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'facturacion' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <ClipboardList className="w-4 h-4" />
                    {sidebarOpen && <span>Solicitudes</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('despachado')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'despachado' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {sidebarOpen && <span>Despachados</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('pendiente')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'pendiente' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Clock className="w-4 h-4" />
                    {sidebarOpen && <span translate="no" className="notranslate">Pendientes</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('vehiculos')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'vehiculos' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Truck className="w-4 h-4" />
                    {sidebarOpen && <span>Vehículos</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('agenda')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'agenda' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Calendar className="w-4 h-4 text-hud-accent" />
                    {sidebarOpen && <span>Agenda / Citas</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Category: Entidades */}
            <div className="space-y-1.5">
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => setExpandedCategories(prev => ({ ...prev, entidades: !prev.entidades }))}
                  className="w-full flex items-center justify-between text-[11px] font-mono font-black text-slate-100 hover:text-white tracking-widest uppercase px-3 py-2 text-left cursor-pointer select-none transition-colors border-b border-slate-800/80 mb-1"
                >
                  <span>Entidades</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${expandedCategories.entidades ? 'rotate-0' : '-rotate-90'}`} />
                </button>
              ) : null}
              {(!sidebarOpen || expandedCategories.entidades) && (
                <div className="space-y-0.5 font-mono text-[11px] font-medium">
                  <button 
                    onClick={() => setActiveTab('transportadoras')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'transportadoras' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Truck className="w-4 h-4" />
                    {sidebarOpen && <span>Operadores</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('clientes')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'clientes' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Users className="w-4 h-4" />
                    {sidebarOpen && <span>Clientes</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Category: Control y Finanzas */}
            <div className="space-y-1.5">
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => setExpandedCategories(prev => ({ ...prev, control: !prev.control }))}
                  className="w-full flex items-center justify-between text-[11px] font-mono font-black text-slate-100 hover:text-white tracking-widest uppercase px-3 py-2 text-left cursor-pointer select-none transition-colors border-b border-slate-800/80 mb-1"
                >
                  <span>Control y Finanzas</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${expandedCategories.control ? 'rotate-0' : '-rotate-90'}`} />
                </button>
              ) : null}
              {(!sidebarOpen || expandedCategories.control) && (
                <div className="space-y-0.5 font-mono text-[11px] font-medium">
                  <button 
                    onClick={() => setActiveTab('provision')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'provision' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <DollarSign className="w-4 h-4" />
                    {sidebarOpen && <span translate="no" className="notranslate">Provisiones</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('diferencias')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'diferencias' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    {sidebarOpen && <span>Diferencias</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('recordatorios')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'recordatorios' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Bell className="w-4 h-4" />
                    {sidebarOpen && <span>Recordatorios</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('liquidador')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'liquidador' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Sliders className="w-4 h-4 text-hud-accent" />
                    {sidebarOpen && <span>Liquidador Carga</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('horasExtras')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'horasExtras' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold text-slate-100' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Clock className="w-4 h-4 text-amber-400 font-bold" />
                    {sidebarOpen && <span>Horas Extras</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('pedidoEmpleados')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'pedidoEmpleados' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <ShoppingBag className="w-4 h-4 text-orange-450 font-bold" />
                    {sidebarOpen && <span>Pedido Empleados</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Category: Inteligencia */}
            <div className="space-y-1.5">
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => setExpandedCategories(prev => ({ ...prev, inteligencia: !prev.inteligencia }))}
                  className="w-full flex items-center justify-between text-[11px] font-mono font-black text-slate-100 hover:text-white tracking-widest uppercase px-3 py-2 text-left cursor-pointer select-none transition-colors border-b border-slate-800/80 mb-1"
                >
                  <span>Inteligencia y GPS</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${expandedCategories.inteligencia ? 'rotate-0' : '-rotate-90'}`} />
                </button>
              ) : null}
              {(!sidebarOpen || expandedCategories.inteligencia) && (
                <div className="space-y-0.5 font-mono text-[11px] font-medium">
                  <button 
                    onClick={() => setActiveTab('seguimiento')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'seguimiento' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Activity className="w-4 h-4" />
                    {sidebarOpen && <span>Seguimiento</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('mapas')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'mapas' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <Map className="w-4 h-4" />
                    {sidebarOpen && <span>Mapas Pro</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'dashboard' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <ChevronDown className="w-4 h-4 -rotate-90" />
                    {sidebarOpen && <span>Análisis de Datos</span>}
                  </button>

                  <button 
                    onClick={() => setActiveTab('dialogo')}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-colors ${activeTab === 'dialogo' ? 'bg-hud-accent/10 border-l-2 border-hud-accent text-hud-accent font-bold' : 'text-slate-200 hover:text-white hover:bg-slate-900/50 font-semibold'}`}
                  >
                    <ClipboardList className="w-4 h-4" />
                    {sidebarOpen && <span>Novedades Diálogo</span>}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Sidebar Footer block */}
        <div className="p-4 border-t border-sky-950/40">
          <button 
            onClick={handleLogout}
            className="w-full text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 p-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors text-xs font-mono"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="font-bold">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
      )}

      {/* Main Container Core Feed */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Core Header */}
        {!isEmployeeMode && (
        <header className="bg-hud-card border-b border-hud-border/50 h-16 shrink-0 flex items-center justify-between px-6 z-30 print:hidden">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(prev => !prev)}
              className="text-slate-400 hover:text-hud-accent p-1 cursor-pointer transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden md:flex flex-col">
              <h1 className="text-sm font-display font-extrabold text-white tracking-widest uppercase">Latin Products S.A.S.</h1>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider font-semibold">Central de Control de Operaciones Nacionales</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono font-bold">
            {isPdfParsing ? (
              <button 
                disabled
                className="bg-slate-900/40 border border-slate-800 text-slate-500 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold font-mono tracking-wider"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-hud-green" /> DIGITALIZANDO...
              </button>
            ) : (
              <button 
                onClick={() => pdfFileInputRef.current?.click()}
                className="bg-hud-green/10 border border-hud-green/30 text-hud-green hover:bg-hud-green/20 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer uppercase text-[10px] font-bold tracking-wider transition-all"
                title="Cargar y digitalizar PDF inteligente (Pedido o Provisión)"
              >
                <Upload className="w-3.5 h-3.5 text-hud-green" /> Cargar PDF
              </button>
            )}
            <input 
              type="file" 
              ref={pdfFileInputRef} 
              onChange={e => e.target.files && processPdfFile(e.target.files[0])}
              accept=".pdf"
              className="hidden" 
            />

            <div className="bg-hud-green/10 border border-hud-green/30 text-hud-green px-3 py-1 rounded-full flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-hud-green pulse-led"></span>
              <span>FIREBASE CONECTADO</span>
            </div>

            <button 
              onClick={() => handleOpenOrderForm()}
              className="bg-hud-accent/10 border border-hud-accent/30 text-hud-accent hover:bg-hud-accent/20 px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer uppercase text-[10px]"
            >
              <ListPlus className="w-4 h-4" /> Crear Flete
            </button>
          </div>
        </header>
        )}

        {/* Tab Module router */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth bg-hud-bg relative">
          
          {/* Active Tab Router */}
          {activeTab === 'inicio' ? (
            <HomeModule 
              orders={orders} 
              onOpenOrder={handleOpenOrderForm}
              customersCount={customers.length}
            />
          ) : null}

          {activeTab === 'facturacion' ? (
            <OrdersModule 
              orders={orders}
              customers={customers}
              carriers={carriers}
              onAddOrder={handleAddOrder}
              onAddOrders={handleAddOrders}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={onDeleteOrder}
              onOpenOrderForm={handleOpenOrderForm}
              onDeleteImportedOrders={handleDeleteImportedOrders}
              onResetDatabase={handleResetDatabase}
            />
          ) : null}

          {activeTab === 'despachado' ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-900">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-extrabold text-[#00ffa3] tracking-widest flex items-center gap-2 uppercase">
                    <CheckCircle2 className="w-5 h-5 text-hud-green" /> Historial de Pedidos Despachados
                  </h2>
                  <p className="text-xs text-slate-400">Archivos consolidados de fletes despachados con factura</p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Buscar PV, Factura, Operador..."
                    value={despachadoSearch}
                    onChange={e => setDespachadoSearch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-white rounded px-8 py-1.5 w-60 outline-none"
                  />
                </div>
              </div>

              {/* Top-Left Pagination & Export Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-hud-card border border-hud-border/30 rounded-lg text-xs font-mono">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Pagination widget */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDespachadoPage(1)}
                      disabled={despachadoPage === 1}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                      title="Primera página"
                    >
                      &laquo;
                    </button>
                    <button
                      onClick={() => setDespachadoPage(p => Math.max(1, p - 1))}
                      disabled={despachadoPage === 1}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-[#00ffa3] disabled:opacity-20 cursor-pointer text-xs flex items-center"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    
                    <span className="text-[#00ffa3] font-bold px-2">
                      PÁG. {despachadoPage} / {totalDespachadosPages}
                    </span>

                    <button
                      onClick={() => setDespachadoPage(p => Math.min(totalDespachadosPages, p + 1))}
                      disabled={despachadoPage === totalDespachadosPages}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-[#00ffa3] disabled:opacity-20 cursor-pointer text-xs flex items-center"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDespachadoPage(totalDespachadosPages)}
                      disabled={despachadoPage === totalDespachadosPages}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                      title="Última página"
                    >
                      &raquo;
                    </button>
                  </div>

                  {/* Export button */}
                  <button
                    onClick={exportDespachadosToExcel}
                    className="bg-hud-green/10 border border-hud-green/30 text-[#00ffa3] hover:bg-hud-green/20 px-3 py-1 rounded text-[10px] font-mono tracking-wider flex items-center gap-1.5 cursor-pointer uppercase font-bold transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-hud-green" /> Exportar a Excel
                  </button>
                </div>

                <div className="text-slate-400 text-xs">
                  Mostrando <strong className="text-white">{filteredDespachados.length === 0 ? 0 : (despachadoPage - 1) * 12 + 1}-{Math.min(filteredDespachados.length, despachadoPage * 12)}</strong> de <strong className="text-[#00ffa3]">{filteredDespachados.length}</strong> despachos fletados
                </div>
              </div>

              {/* Table rendering of dispatched orders */}
              <div className="bg-hud-card border border-hud-border/50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#030610] text-[#476a8a] border-b border-hud-border/40 text-[10px] tracking-widest uppercase">
                      <tr>
                        <th className="p-4">ID / PV</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4 flex-1">Destino & Transportador</th>
                        <th className="p-4">Placa</th>
                        <th className="p-4">Factura N°</th>
                        <th className="p-4 text-center">Cajas (Fact/Solic)</th>
                        <th className="p-4 text-center">Peso (Fact/Solic)</th>
                        <th className="p-4 text-center">Valor Facturado ($)</th>
                        <th className="p-4 text-center">% Flete s/ Fact</th>
                        <th className="p-4 text-center">Flete Valor</th>
                        <th className="p-4 text-center">Estado</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-950/65 text-slate-300">
                      {paginatedDespachados.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-slate-500">No hay registros despachados en muelle.</td>
                        </tr>
                      ) : (
                        paginatedDespachados.map(o => {
                          const actualVal = o.facturado && o.facturado > 0 ? o.facturado : o.venta;
                          const pct = actualVal > 0 ? (o.flete / actualVal) * 100 : 0;
                          
                          let colorClass = "text-[#00ffa3] font-extrabold";
                          if (pct > 15) colorClass = "text-rose-400 font-extrabold";
                          else if (pct > 10) colorClass = "text-hud-orange font-extrabold";

                          return (
                            <tr key={o.id} className="hover:bg-slate-900/10">
                              <td className="p-4 font-bold text-white">{o.id} <span className="text-[9px] block text-slate-500">PV: {o.pv}</span></td>
                              <td className="p-4 font-sans font-medium text-white">{o.cliente}</td>
                              <td className="p-4 font-sans text-slate-400">
                                <div>{o.ciudad}</div>
                                <div className="text-[10px] text-slate-500 font-mono font-medium">{o.transportadora}</div>
                              </td>
                              <td className="p-4 font-bold text-white">{o.placa || "N/A"}</td>
                              <td className="p-4 text-[#00ffa3] font-bold">{o.factura || "FALTANTE"}</td>
                              <td className="p-4 text-center">
                                <span className="text-white font-bold">{o.cajasFact || o.cajas}</span>
                                <span className="text-[10px] text-slate-500 font-normal"> / {o.cajas}</span>
                              </td>
                              <td className="p-4 text-center text-slate-300">
                                <span className="text-slate-200 font-bold">{(o.pesoFact || o.peso).toLocaleString()}</span>
                                <span className="text-[10px] text-slate-500 font-normal"> / {o.peso.toLocaleString()} kg</span>
                              </td>
                              <td className="p-4 text-center text-hud-green font-bold">
                                ${(o.facturado || o.venta).toLocaleString('es-CO')}
                                <span className="text-[9px] text-slate-500 block font-normal">Solicitado: ${o.venta.toLocaleString('es-CO')}</span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`${colorClass} font-mono`}>{pct.toFixed(2)}%</span>
                              </td>
                              <td className="p-4 text-center text-hud-green font-bold">${o.flete.toLocaleString('es-CO')}</td>
                              <td className="p-4 text-center">
                                <span className="text-[9px] bg-hud-green/10 border border-hud-green text-hud-green px-2 py-0.5 rounded font-mono uppercase font-bold">
                                  {o.estado}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'pendiente' ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-900">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-extrabold text-[#ffab00] tracking-widest flex items-center gap-2 uppercase">
                    <Clock className="w-5 h-5 text-hud-orange" /> Pedidos Pendientes de Despacho
                  </h2>
                  <p className="text-xs text-slate-400">Órdenes digitales verificadas esperando asignación flete masivo</p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Filtrar pendientes..."
                    value={pendienteSearch}
                    onChange={e => setPendienteSearch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-white rounded px-8 py-1.5 w-60 outline-none"
                  />
                </div>
              </div>

              {/* Top-Left Pagination & Export Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-hud-card border border-hud-border/30 rounded-lg text-xs font-mono">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Pagination widget */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPendientePage(1)}
                      disabled={pendientePage === 1}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                      title="Primera página"
                    >
                      &laquo;
                    </button>
                    <button
                      onClick={() => setPendientePage(p => Math.max(1, p - 1))}
                      disabled={pendientePage === 1}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-[#ffab00] disabled:opacity-20 cursor-pointer text-xs flex items-center"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    
                    <span className="text-[#ffab00] font-bold px-2">
                      PÁG. {pendientePage} / {totalPendientesPages}
                    </span>

                    <button
                      onClick={() => setPendientePage(p => Math.min(totalPendientesPages, p + 1))}
                      disabled={pendientePage === totalPendientesPages}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-[#ffab00] disabled:opacity-20 cursor-pointer text-xs flex items-center"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPendientePage(totalPendientesPages)}
                      disabled={pendientePage === totalPendientesPages}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                      title="Última página"
                    >
                      &raquo;
                    </button>
                  </div>

                  {/* Export button */}
                  <button
                    onClick={exportPendientesToExcel}
                    className="bg-hud-orange/10 border border-hud-orange/30 text-[#ffab00] hover:bg-hud-orange/20 px-3 py-1 rounded text-[10px] font-mono tracking-wider flex items-center gap-1.5 cursor-pointer uppercase font-bold transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-hud-orange" /> Exportar a Excel
                  </button>
                </div>

                <div className="text-slate-400 text-xs">
                  Mostrando <strong className="text-white">{filteredPendientes.length === 0 ? 0 : (pendientePage - 1) * 12 + 1}-{Math.min(filteredPendientes.length, pendientePage * 12)}</strong> de <strong className="text-[#ffab00]">{filteredPendientes.length}</strong> pendientes
                </div>
              </div>

              {/* Pendientes table list */}
              <div className="bg-hud-card border border-hud-border/70 rounded-lg overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#030610] text-[#476a8a] border-b border-hud-border/40 text-[10px] tracking-widest uppercase">
                    <tr>
                      <th className="p-4">Flete ID</th>
                      <th className="p-4">Cliente Solicitante</th>
                      <th className="p-4">Localidad</th>
                      <th className="p-4 text-center">Cajas (cj)</th>
                      <th className="p-4 text-center">Peso</th>
                      <th className="p-4 text-center">Valor Comercial</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-slate-300">
                    {paginatedPendientes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">Muelle libre. No hay solicitudes pendientes de flete.</td>
                      </tr>
                    ) : (
                      paginatedPendientes.map(o => (
                        <tr key={o.id} className="hover:bg-slate-900/10">
                          <td className="p-4 font-bold text-white">{o.id}</td>
                          <td className="p-4 font-sans font-medium text-white">{o.cliente}</td>
                          <td className="p-4 font-sans text-slate-400">{o.ciudad}</td>
                          <td className="p-4 text-center font-bold text-white">{o.cajas} cj</td>
                          <td className="p-4 text-center text-hud-green">{o.peso} kg</td>
                          <td className="p-4 text-center text-hud-green font-bold">${o.venta.toLocaleString('es-CO')}</td>
                          <td className="p-4 text-center">
                            <span 
                              onClick={() => handleOpenOrderForm(o)} 
                              className="text-[10px] border border-hud-accent/30 text-hud-accent p-1.5 rounded cursor-pointer hover:bg-hud-accent/15"
                            >
                              Asignar Flete
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === 'vehiculos' ? (
            <VehiclesModule 
              orders={orders} 
              onOpenOrder={handleOpenOrderForm}
            />
          ) : null}

          {/* Tab: Operadores / Transportadoras CRUD */}
          {activeTab === 'transportadoras' ? (
            <div className="space-y-6 animate-fade-in font-mono text-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-900">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-extrabold text-hud-accent tracking-widest flex items-center gap-2 uppercase">
                    <Truck className="w-5 h-5 text-hud-accent" /> Socios Operadores de Transporte
                  </h2>
                  <p className="text-xs text-slate-400">Lista contractual de transportadoras habilitadas nacionalmente</p>
                </div>

                <button 
                  onClick={() => handleOpenCarrierForm()}
                  className="bg-hud-accent text-slate-950 font-black tracking-widest px-4 py-2.5 rounded-lg flex items-center gap-1.5 uppercase hover:scale-[1.01]"
                >
                  <Plus className="w-4 h-4" /> Nuevo Operador
                </button>
              </div>

              {/* Top-Left Pagination & Export Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-hud-card border border-hud-border/30 rounded-lg text-xs font-mono">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Pagination widget */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCarrierPage(1)}
                      disabled={carrierPage === 1}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                      title="Primera página"
                    >
                      &laquo;
                    </button>
                    <button
                      onClick={() => setCarrierPage(p => Math.max(1, p - 1))}
                      disabled={carrierPage === 1}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-[#00ffa3] disabled:opacity-20 cursor-pointer text-xs flex items-center"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    
                    <span className="text-[#00ffa3] font-bold px-2">
                      PÁG. {carrierPage} / {totalCarriersPages}
                    </span>

                    <button
                      onClick={() => setCarrierPage(p => Math.min(totalCarriersPages, p + 1))}
                      disabled={carrierPage === totalCarriersPages}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-[#00ffa3] disabled:opacity-20 cursor-pointer text-xs flex items-center"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCarrierPage(totalCarriersPages)}
                      disabled={carrierPage === totalCarriersPages}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                      title="Última página"
                    >
                      &raquo;
                    </button>
                  </div>

                  {/* Export button */}
                  <button
                    onClick={exportCarriersToExcel}
                    className="bg-hud-accent/10 border border-hud-accent/30 text-hud-accent hover:bg-hud-accent/20 px-3 py-1 rounded text-[10px] font-mono tracking-wider flex items-center gap-1.5 cursor-pointer uppercase font-bold transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-hud-accent" /> Exportar a Excel
                  </button>
                </div>

                <div className="text-slate-400 text-xs">
                  Mostrando <strong className="text-white">{carriers.length === 0 ? 0 : (carrierPage - 1) * 12 + 1}-{Math.min(carriers.length, carrierPage * 12)}</strong> de <strong className="text-hud-accent">{carriers.length}</strong> transportadoras
                </div>
              </div>

              {/* Table List of Carriers */}
              <div className="bg-hud-card border border-hud-border/70 rounded-lg overflow-hidden shadow-xl">
                <table className="w-full text-left">
                  <thead className="bg-[#030610] text-[#476a8a] border-b border-hud-border/40 text-[10px] tracking-widest uppercase">
                    <tr>
                      <th className="p-4">Identidad</th>
                      <th className="p-4">NIT</th>
                      <th className="p-4">Sede Central</th>
                      <th className="p-4">Canal Contacto</th>
                      <th className="p-4 text-right">Tarifa Sugerida</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-slate-300 font-mono">
                    {paginatedCarriers.map(c => (
                      <tr key={c.id} className="hover:bg-slate-900/10">
                        <td className="p-4 font-bold text-white">{c.nombre}</td>
                        <td className="p-4 text-slate-400">{c.nit}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">{c.ciudad}</div>
                          {c.dir && <div className="text-[10px] text-slate-500 font-sans">{c.dir}</div>}
                        </td>
                        <td className="p-4 text-xs font-sans space-y-0.5">
                          <div className="font-semibold text-slate-200">💬 {c.contacto}</div>
                          <div className="text-[10px] text-slate-400 font-mono">📞 {c.tel}</div>
                          {c.correo && <div className="text-[10px] text-hud-accent font-mono truncate max-w-[200px]" title={c.correo}>✉️ {c.correo}</div>}
                        </td>
                        <td className="p-4 text-right text-hud-green font-bold">${c.costoSugerido.toLocaleString('es-CO')}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleOpenCarrierForm(c.id)}
                            className="text-hud-accent hover:underline font-bold"
                          >
                            EDITAR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Tab: Clientes CRUD */}
          {activeTab === 'clientes' ? (
            <div className="space-y-6 animate-fade-in font-mono text-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-900">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-extrabold text-[#00ffa3] tracking-widest flex items-center gap-2 uppercase">
                    <Users className="w-5 h-5 text-hud-green" /> Malla y Registro de Clientes
                  </h2>
                  <p className="text-xs text-slate-400">Planillas de requerimientos logísticos de entrega por andén</p>
                </div>

                <button 
                  onClick={() => handleOpenCustomerForm()}
                  className="bg-[#00ffa3] text-slate-950 font-black tracking-widest px-4 py-2.5 rounded-lg flex items-center gap-1.5 uppercase hover:scale-[1.01]"
                >
                  <Plus className="w-4 h-4" /> Registrar Cliente
                </button>
              </div>

              {/* Top-Left Pagination & Export Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-hud-card border border-hud-border/30 rounded-lg text-xs font-mono">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Pagination widget */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCustomerPage(1)}
                      disabled={customerPage === 1}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                      title="Primera página"
                    >
                      &laquo;
                    </button>
                    <button
                      onClick={() => setCustomerPage(p => Math.max(1, p - 1))}
                      disabled={customerPage === 1}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-[#00ffa3] disabled:opacity-20 cursor-pointer text-xs flex items-center"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    
                    <span className="text-[#00ffa3] font-bold px-2">
                      PÁG. {customerPage} / {totalCustomersPages}
                    </span>

                    <button
                      onClick={() => setCustomerPage(p => Math.min(totalCustomersPages, p + 1))}
                      disabled={customerPage === totalCustomersPages}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-[#00ffa3] disabled:opacity-20 cursor-pointer text-xs flex items-center"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCustomerPage(totalCustomersPages)}
                      disabled={customerPage === totalCustomersPages}
                      className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                      title="Última página"
                    >
                      &raquo;
                    </button>
                  </div>

                  {/* Export button */}
                  <button
                    onClick={exportCustomersToExcel}
                    className="bg-hud-green/10 border border-hud-green/30 text-[#00ffa3] hover:bg-hud-green/20 px-3 py-1 rounded text-[10px] font-mono tracking-wider flex items-center gap-1.5 cursor-pointer uppercase font-bold transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-hud-green" /> Exportar a Excel
                  </button>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-550 absolute left-2.5 top-1/2 -translate-y-1/2 font-bold" />
                    <input 
                      type="text" 
                      placeholder="Buscar por Nombre, NIT, Ciudad, Malla..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="bg-slate-950 border border-slate-850 text-[11px] text-white rounded pl-8 pr-3 py-1 w-64 outline-none focus:border-[#00ffa3]"
                    />
                    {customerSearch && (
                      <button 
                        onClick={() => setCustomerSearch('')}
                        className="text-[10px] text-hud-red hover:underline absolute right-2.5 top-1/2 -translate-y-1/2 font-mono uppercase"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-slate-400 text-xs">
                  Mostrando <strong className="text-white">{filteredCustomers.length === 0 ? 0 : (customerPage - 1) * 8 + 1}-{Math.min(filteredCustomers.length, customerPage * 8)}</strong> de <strong className="text-hud-green">{filteredCustomers.length}</strong> clientes
                </div>
              </div>

              {/* Table list of customers */}
              <div className="bg-hud-card border border-hud-border/70 rounded-lg overflow-hidden shadow-xl">
                <table className="w-full text-left">
                  <thead className="bg-[#030610] text-[#476a8a] border-b border-hud-border/40 text-[10px] tracking-widest uppercase">
                    <tr>
                      <th className="p-4">Razón Social</th>
                      <th className="p-4">Nit</th>
                      <th className="p-4">Dirección Exacta</th>
                      <th className="p-4">Contacto</th>
                      <th className="p-4 text-center">Malla Entrega</th>
                      <th className="p-4 text-center">Cita</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-slate-350 font-mono">
                    {paginatedCustomers.map(c => (
                      <tr key={c.id} className="hover:bg-slate-900/10">
                        <td className="p-4 font-bold text-white max-w-xs truncate">{c.nombre}</td>
                        <td className="p-4 text-[11px] text-slate-400">{c.nit}</td>
                        <td className="p-4 font-sans text-slate-400 max-w-xs truncate">{c.dir} ({c.ciudad})</td>
                        <td className="p-4">
                          <div>👤 {c.contacto}</div>
                          <div className="text-[10px] text-slate-500 font-mono">📱 {c.celular}</div>
                        </td>
                        <td className="p-4 text-center text-[10.5px] text-hud-green">{c.malla || "Mercancía Lista"}</td>
                        <td className="p-4 text-center">
                          <span className={`text-[9.5px] px-1.5 py-0.5 rounded ${
                            c.cita === 'SI' ? 'bg-[#ff9100]/10 text-hud-orange border border-hud-orange/30' : 'bg-hud-green/10 text-hud-green border border-hud-green/30'
                          }`}>
                            {c.cita}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleOpenCustomerForm(c.id)}
                            className="text-hud-accent hover:underline font-bold"
                          >
                            EDITAR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === 'provision' ? (
            <ProvisionesModule 
              orders={orders}
              onUpdateOrder={handleUpdateOrder}
            />
          ) : null}

          {activeTab === 'diferencias' ? (
            <DiferenciasModule orders={orders} />
          ) : null}

          {activeTab === 'recordatorios' ? (
            <RemindersModule 
              reminders={reminders}
              onAddReminder={row => saveReminders([...reminders, row])}
              onToggleReminder={id => saveReminders(reminders.map(r => r.id === id ? { ...r, completado: !r.completado } : r))}
              onDeleteReminder={id => saveReminders(reminders.filter(r => r.id !== id))}
            />
          ) : null}

          {activeTab === 'agenda' ? (
            <CitasModule />
          ) : null}

          {activeTab === 'seguimiento' ? (
            <div className="space-y-6 animate-fade-in font-mono text-xs">
              <div className="flex flex-col gap-1 pb-3 border-b border-slate-900">
                <h2 className="text-xl font-display font-extrabold text-[#00ffa3] tracking-widest flex items-center gap-2 uppercase">
                  <Activity className="w-5 h-5 text-hud-green pulse-led" /> Monitoreo y Seguimiento Satelital
                </h2>
                <p className="text-xs text-slate-400">Metodos de control de fletes despachados activos en ruta nacional</p>
              </div>

              {/* Timeline blocks */}
              <div className="space-y-4">
                {activeTracking.length === 0 ? (
                  <div className="bg-hud-card p-12 text-center text-slate-500 font-mono border border-slate-900 rounded-lg">
                    -- No se disponen de transportadores en tránsito actualmente --
                  </div>
                ) : (
                  activeTracking.map(track => (
                    <div key={track.id} className="bg-hud-card border border-hud-border/70 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#ffaa00]/10 border border-[#ffaa00] text-hud-orange text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                            EN TRÁNSITO
                          </span>
                          <strong className="text-white font-sans text-sm">{track.cliente}</strong>
                        </div>
                        <p className="text-slate-405 font-sans leading-relaxed">
                          Flete <strong className="text-hud-accent">{track.id}</strong> transportado por <strong className="text-white">{track.transportadora}</strong> bajo mando de <strong className="text-[#00ffa3]">{track.conductor}</strong>.
                        </p>
                        <div className="flex items-center gap-4 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1 font-mono">
                            Placa: <strong className="text-white">{track.placa}</strong>
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            CBoxes: <strong className="text-white">{track.cajas}</strong>
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            Destino: <strong className="text-hud-accent">{track.ciudad}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Rapid Status advance button */}
                        <button 
                          onClick={() => handleUpdateOrder({ ...track, estado: 'Entregado', fechaEntrega: new Date().toISOString().split('T')[0] })}
                          className="bg-hud-green hover:bg-hud-green/80 text-slate-950 font-black px-4 py-2 rounded text-[10px]"
                        >
                          ENTREGAR ✔️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {/* Tab: Mapas Pro visual depiction representing Colombia */}
          {activeTab === 'mapas' ? (
            <div className="space-y-6 animate-fade-in font-mono text-xs">
              <div className="flex flex-col gap-1 pb-3 border-b border-slate-900">
                <h2 className="text-xl font-display font-extrabold text-[#f43f5e] tracking-widest flex items-center gap-2 uppercase">
                  <Map className="w-5 h-5 text-hud-red" /> Mapas Pro: Terminal Satelital Nacional
                </h2>
                <p className="text-xs text-slate-400">Visualización geográfica de muelle principal Acopi hacia nodos colombianos</p>
              </div>

              {/* Map depiction */}
              <div className="bg-hud-card border-2 border-hud-red/40 rounded-xl p-6 shadow-2xl relative overflow-hidden h-[500px] flex flex-col justify-between">
                
                {/* Simulation map grid background */}
                <div className="absolute inset-0 bg-slate-950 opacity-90 flex flex-col justify-between pointer-events-none p-4">
                  <div className="grid grid-cols-12 gap-1 h-full w-full opacity-10">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <div key={i} className="border border-hud-red h-full w-full"></div>
                    ))}
                  </div>
                </div>

                <div className="z-10 bg-slate-900/90 border border-slate-800 p-4 rounded-lg max-w-sm space-y-2">
                  <h3 className="text-sm font-display font-extrabold text-[#f43f5e] uppercase">Centro logístico Acopi-Yumbo</h3>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Geolocalización satelital activa. Trazando fletes despachados hacia las principales básculas nacionales de descarga:
                  </p>
                  <div className="space-y-1 text-[9px] pt-1">
                    <div className="flex items-center justify-between text-hud-green">
                      <span>🟢 Bogotá D.C.</span> <strong>En ruta: {orders.filter(o => o.ciudad === 'Bogotá' && o.estado === 'Despachado').length} fletes</strong>
                    </div>
                    <div className="flex items-center justify-between text-hud-accent">
                      <span>🔵 Medellín (Antioquia)</span> <strong>En ruta: {orders.filter(o => o.ciudad === 'Medellín' && o.estado === 'Despachado').length} fletes</strong>
                    </div>
                    <div className="flex items-center justify-between text-hud-orange">
                      <span>🟡 Cali (Valle)</span> <strong>En ruta: {orders.filter(o => o.ciudad === 'Cali' && o.estado === 'Despachado').length} fletes</strong>
                    </div>
                  </div>
                </div>

                {/* Cyberpunk Map Graphic Visual with labels */}
                <div className="z-10 relative flex justify-center items-center h-48 w-full select-none">
                  {/* Yumbo Acopi Core */}
                  <div className="absolute top-1/2 left-1/4 -translate-y-1/2 flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-hud-red border-2 border-white pulse-led flex items-center justify-center">
                      <span className="w-2 h-2 bg-white rounded-full"></span>
                    </div>
                    <strong className="text-white text-[10px] mt-1 shadow bg-[#091124] px-1.5 py-0.5 rounded">ACOPI YUMBO</strong>
                  </div>

                  {/* Route line simulation links */}
                  {/* Route 1: Bogotá */}
                  <div className="absolute top-1/4 left-1/2 flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-hud-green border border-white flex items-center justify-center">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    </div>
                    <strong className="text-slate-300 text-[9px] mt-1 bg-[#091124] px-1 py-0.2 rounded">BOGOTÁ (CENTRO)</strong>
                  </div>

                  {/* Route 2: Medellín */}
                  <div className="absolute top-1/5 left-1/3 flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-hud-accent border border-white flex items-center justify-center">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    </div>
                    <strong className="text-slate-300 text-[9px] mt-1 bg-[#091124] px-1 py-0.2 rounded">MEDELLÍN (OSTE)</strong>
                  </div>

                  {/* Connecting virtual vector dotted lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" xmlns="http://www.w3.org/2000/svg">
                    {/* Path to Medellin */}
                    <path d="M 230 110 Q 280 80 340 50" fill="none" stroke="#00d2ff" strokeWidth="2" strokeDasharray="5,5" />
                    {/* Path to Bogota */}
                    <path d="M 230 110 Q 320 100 450 60" fill="none" stroke="#00ffa3" strokeWidth="2" strokeDasharray="5,5" />
                  </svg>
                </div>

                <div className="z-10 bg-slate-900 p-2 rounded text-center text-slate-500 text-[9px] font-mono border border-slate-800">
                  🛰️ CONECTADO A CONSTELACIÓN GPS DE ENTRADAS - NODO ACOPI-YUMBO SECURE LINK
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'dashboard' ? (
            <AnalyticsModule 
              orders={orders}
              carriers={carriers}
            />
          ) : null}

          {activeTab === 'dialogo' ? (
            <NovedadesModule 
              novedades={novedades}
              onAddNovedad={row => saveNovedades([row, ...novedades])}
              onUpdateNovedad={row => saveNovedades(novedades.map(n => n.id === row.id ? row : n))}
              onDeleteNovedad={id => saveNovedades(novedades.filter(n => n.id !== id))}
            />
          ) : null}

          {activeTab === 'liquidador' ? (
            <LiquidadorModule />
          ) : null}

          {activeTab === 'horasExtras' ? (
            <HorasModule />
          ) : null}

          {activeTab === 'pedidoEmpleados' ? (
            <PedidosModule />
          ) : null}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* 🛠️ MODAL FOR ADDTING / EDITING ORDERS (DETAILED DRAW PANEL)             */}
      {/* ========================================================================= */}
      {isOrderFormOpen && editingOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[10500] flex items-center justify-center p-4">
          <div className="bg-[#0a1224] border-2 border-hud-accent/60 rounded-xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto font-mono text-xs text-slate-350">
            
            <div className="flex items-center justify-between pb-2.5 border-b border-sky-950">
              <div>
                <h3 className="text-base font-display font-black text-hud-accent tracking-widest uppercase">
                  FICHA DE CONTROL DETALLADO LOGÍSTICO
                </h3>
                <p className="text-[9px] text-[#476a8a] font-bold uppercase tracking-wider">LATIN PRODUCTS SAS | PANEL DE CARGA</p>
              </div>
              <button onClick={() => setIsOrderFormOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-hud-accent font-bold uppercase block">Flete ID</label>
                <input 
                  type="text" 
                  readOnly
                  value={editingOrder.id}
                  className="bg-black border border-hud-accent/20 p-2.5 rounded text-hud-accent font-bold w-full text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">Pedido de Venta (PV)</label>
                <input 
                  type="text" 
                  value={editingOrder.pv}
                  onChange={e => setEditingOrder({ ...editingOrder, pv: e.target.value })}
                  placeholder="E.g., 4500308925"
                  className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none font-bold focus:border-hud-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">Orden Compra (OC)</label>
                <input 
                  type="text" 
                  value={editingOrder.oc}
                  onChange={e => setEditingOrder({ ...editingOrder, oc: e.target.value })}
                  className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none"
                />
              </div>

              {/* Selection row elements */}
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-slate-400 uppercase block">Cliente Destinatario</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escribe para buscar..."
                    value={orderFormClientSearch}
                    onChange={e => setOrderFormClientSearch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-white rounded p-2.5 w-1/3 outline-none focus:border-hud-accent font-mono placeholder-slate-600"
                  />
                  <select 
                    value={editingOrder.cliente}
                    onChange={e => {
                      const match = customers.find(c => c.nombre === e.target.value);
                      setEditingOrder({ 
                        ...editingOrder, 
                        cliente: e.target.value,
                        ciudad: match ? match.ciudad : editingOrder.ciudad
                      });
                    }}
                    className="bg-slate-950 border border-slate-800 text-xs text-white rounded p-2.5 flex-1 outline-none font-bold"
                  >
                    {editingOrder.cliente && !customers.some(c => c.nombre === editingOrder.cliente) && (
                      <option value={editingOrder.cliente}>{editingOrder.cliente}</option>
                    )}
                    {customers
                      .filter(c => {
                        const q = orderFormClientSearch.toLowerCase().trim();
                        if (!q) return true;
                        return c.nombre.toLowerCase().includes(q) ||
                               (c.nit && c.nit.toLowerCase().includes(q)) ||
                               (c.ciudad && c.ciudad.toLowerCase().includes(q));
                      })
                      .map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">Ciudad Sede Destino</label>
                <input 
                  type="text" 
                  value={editingOrder.ciudad}
                  onChange={e => setEditingOrder({ ...editingOrder, ciudad: e.target.value })}
                  className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none font-bold"
                />
              </div>

              {/* cargo metrics */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">Peso Neto (Kg)</label>
                <input 
                  type="number" 
                  value={editingOrder.peso}
                  onChange={e => handleUpdateEditingOrderField('peso', Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-hud-green font-bold rounded p-2.5 w-full outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">Total Cajas (Cj)</label>
                <input 
                  type="number" 
                  value={editingOrder.cajas}
                  onChange={e => handleUpdateEditingOrderField('cajas', Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-hud-green font-bold rounded p-2.5 w-full outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">Valor Venta comercial</label>
                <input 
                  type="number" 
                  value={editingOrder.venta}
                  onChange={e => handleUpdateEditingOrderField('venta', Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-hud-green font-bold rounded p-2.5 w-full outline-none"
                />
              </div>

              {/* Transit Operators */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">Operador seleccionado</label>
                <select 
                  value={editingOrder.transportadora}
                  onChange={e => handleUpdateEditingOrderField('transportadora', e.target.value)}
                  disabled={editingOrder.estado === 'Pendiente'}
                  className={`bg-slate-950 border border-slate-800 text-xs text-white rounded p-2.5 w-full outline-none font-bold ${editingOrder.estado === 'Pendiente' ? 'opacity-60 cursor-not-allowed text-slate-500' : ''}`}
                >
                  {editingOrder.estado === 'Pendiente' ? (
                    <option value="">SIN ASIGNAR (PENDIENTE DE PROGRAMACIÓN)</option>
                  ) : (
                    <>
                      {!editingOrder.transportadora && <option value="">-- SELECCIONE OPERADOR --</option>}
                      {editingOrder.transportadora && !carriers.some(c => c.nombre === editingOrder.transportadora) && (
                        <option value={editingOrder.transportadora}>{editingOrder.transportadora}</option>
                      )}
                      {carriers.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1 text-slate-400">
                <label className="text-[10px] uppercase block">Placa</label>
                <input 
                  type="text" 
                  value={editingOrder.placa}
                  onChange={e => setEditingOrder({ ...editingOrder, placa: e.target.value })}
                  placeholder="E.g., SWD-913"
                  className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none"
                />
              </div>

              <div className="space-y-1 text-slate-400">
                <label className="text-[10px] uppercase block">Conductor</label>
                <input 
                  type="text" 
                  value={editingOrder.conductor}
                  onChange={e => setEditingOrder({ ...editingOrder, conductor: e.target.value })}
                  className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none"
                />
              </div>

              {/* billing realities */}
              <div className="col-span-3 bg-hud-green/5 border border-hud-green/10 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-hud-green font-bold uppercase block">Factura venta de despacho</label>
                  <input 
                    type="text" 
                    value={editingOrder.factura}
                    onChange={e => handleUpdateEditingOrderField('factura', e.target.value)}
                    className="bg-slate-950 border border-hud-green/20 text-[#00ffa3] font-bold rounded p-2 w-full outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase block">Valor Final Facturado ($)</label>
                  <input 
                    type="number" 
                    value={editingOrder.facturado || ''}
                    onChange={e => handleUpdateEditingOrderField('facturado', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-white rounded p-2 w-full outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase block">Cajas Facturadas (cj)</label>
                  <input 
                    type="number" 
                    value={editingOrder.cajasFact || ''}
                    onChange={e => handleUpdateEditingOrderField('cajasFact', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-white rounded p-2 w-full outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase block font-bold tracking-wider text-hud-green">Peso Facturado (kg)</label>
                  <input 
                    type="number" 
                    value={editingOrder.pesoFact || ''}
                    onChange={e => handleUpdateEditingOrderField('pesoFact', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-white rounded p-2 w-full outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-rose-450 font-bold uppercase block">Factura Provisión (Tr.)</label>
                  <input 
                    type="text" 
                    value={editingOrder.provision || ''}
                    onChange={e => handleUpdateEditingOrderField('provision', e.target.value)}
                    placeholder="E.g., PRV-901"
                    className="bg-slate-950 border border-rose-500/20 text-rose-300 font-bold rounded p-2 w-full outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase block">Costo Transporte Flete ($)</label>
                  <input 
                    type="number" 
                    value={editingOrder.flete || 0}
                    onChange={e => handleUpdateEditingOrderField('flete', Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-[#ffab00] font-bold rounded p-2 w-full outline-none"
                  />
                </div>
              </div>

              {/* 📅 PROGRAMACIÓN Y FECHAS */}
              <div className="col-span-3 border-t border-slate-800/60 pt-4 mt-2">
                <h4 className="text-[11px] font-bold text-[#ffaa00] uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  📅 PROGRAMACIÓN Y FECHAS
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase block">Salida</label>
                    <input 
                      type="date" 
                      value={editingOrder.fechaSalida || ''}
                      onChange={e => setEditingOrder({ ...editingOrder, fechaSalida: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none focus:border-hud-accent text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase block">Entrega Estimada</label>
                    <input 
                      type="date" 
                      value={editingOrder.fechaEntrega || ''}
                      onChange={e => setEditingOrder({ ...editingOrder, fechaEntrega: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none focus:border-hud-accent text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase block">Hora Cita</label>
                    <input 
                      type="text" 
                      placeholder="E.g., 08:00 o 14:30"
                      value={editingOrder.horaCita || ''}
                      onChange={e => setEditingOrder({ ...editingOrder, horaCita: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none focus:border-hud-accent text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-hud-green font-bold uppercase block">Fecha Facturación</label>
                    <input 
                      type="date" 
                      value={editingOrder.fechaFactura || ''}
                      onChange={e => setEditingOrder({ ...editingOrder, fechaFactura: e.target.value })}
                      className="bg-slate-950 border border-hud-green/20 text-[#00ffa3] font-bold rounded p-2.5 w-full outline-none focus:border-hud-green text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* State control */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">Estado de Lote</label>
                <select 
                  value={editingOrder.estado}
                  onChange={e => {
                    const newEstado = e.target.value as any;
                    let nextOrder = { ...editingOrder, estado: newEstado };
                    if (newEstado === 'Pendiente') {
                      nextOrder.transportadora = '';
                      nextOrder.flete = 0;
                    } else if (!nextOrder.transportadora) {
                      nextOrder.transportadora = carriers[0]?.nombre || '';
                      // Recalculate flete for the new carrier
                      const isFredyCarrier = (name: string | undefined | null) => {
                        if (!name) return false;
                        const upper = name.toUpperCase();
                        return upper.includes("FREDY") && (upper.includes("HERNANDEZ") || upper.includes("HERNÁNDEZ"));
                      };
                      const isFredy = isFredyCarrier(nextOrder.transportadora);
                      if (isFredy) {
                        const vFact = Number(nextOrder.facturado) > 0 ? Number(nextOrder.facturado) : Number(nextOrder.venta || 0);
                        const cFact = Number(nextOrder.cajasFact) > 0 ? Number(nextOrder.cajasFact) : Number(nextOrder.cajas || 0);
                        nextOrder.flete = Math.round((vFact * 0.035) + (cFact * 400));
                      } else {
                        const matched = carriers.find(c => c.nombre === nextOrder.transportadora);
                        if (matched) {
                          nextOrder.flete = matched.costoSugerido || 0;
                        }
                      }
                    }
                    setEditingOrder(nextOrder);
                  }}
                  className="bg-slate-950 border border-slate-800 text-xs text-white rounded p-2.5 w-full outline-none font-bold"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Cargue">En Cargue</option>
                  <option value="Despachado">Despachado</option>
                  <option value="En Sitio / Bodega">En Sitio / Bodega</option>
                  <option value="Entregado">Entregado</option>
                  <option value="Finalizado">Finalizado</option>
                </select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-slate-400 uppercase block">Observaciones Generales</label>
                <input 
                  type="text" 
                  value={editingOrder.obs}
                  onChange={e => setEditingOrder({ ...editingOrder, obs: e.target.value })}
                  className="bg-slate-950 border border-slate-800 text-white rounded p-2.5 w-full outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-sky-950">
              <button 
                type="button" 
                onClick={() => triggerAuditCancellation(editingOrder.id)}
                className="bg-rose-500/10 border border-rose-500/40 hover:bg-rose-500/20 text-rose-500 px-4 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
              >
                <Trash2 className="w-4 h-4" /> ANULAR PEDIDO
              </button>

              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsOrderFormOpen(false)}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-350 px-5 py-2.5 rounded-lg"
                >
                  Cerrar
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    const isNew = !orders.some(o => o.id === editingOrder.id);
                    if (isNew) handleAddOrder(editingOrder);
                    else handleUpdateOrder(editingOrder);
                    setIsOrderFormOpen(false);
                  }}
                  className="bg-hud-accent text-slate-950 font-black tracking-widest px-6 py-2.5 rounded-lg hover:bg-hud-accent/80 transition-all font-display uppercase"
                >
                  GUARDAR PEDIDO ✔️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔐 MODAL: AUDITORÍA DE ANULACIÓN CON PIN DE ACCESO                       */}
      {/* ========================================================================= */}
      {auditTargetId && (
        <div className="fixed inset-0 bg-slate-950 bg-opacity-90 backdrop-blur-md z-[13000] flex items-center justify-center p-4">
          <div className="bg-[#080d19] border-2 border-rose-500/50 rounded-xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 text-xs font-mono">
            <div className="flex items-center gap-2 pb-2.5 border-b border-rose-500/20 text-rose-500">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <h3 className="text-xs font-display font-extrabold uppercase tracking-widest">Auditoría de Anulación</h3>
            </div>

            <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
              La anulación de la solicitud <strong className="text-white">{auditTargetId}</strong> requiere la introducción del PIN operativo de control del supervisor de planta.
            </p>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[9px] text-[#00ffa3] font-bold block uppercase tracking-widest">Introducir PIN (4 dígitos) *</label>
                <input 
                  type="password" 
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={auditPinInput}
                  onChange={e => setAuditPinInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmCancellation()}
                  placeholder="••••"
                  className="bg-black border-2 border-rose-500/30 text-xl font-extrabold text-[#00ffa3] rounded-lg p-2.5 tracking-[8px] text-center outline-none w-full"
                />

                {/* On-screen virtual numeric keypad */}
                <div className="grid grid-cols-3 gap-1 pt-1.5 max-w-[180px] mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAuditPinInput(prev => (prev + num).slice(0, 4))}
                      className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-white text-xs py-1.5 rounded font-mono font-bold active:scale-95 transition-all cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAuditPinInput(prev => prev.slice(0, -1))}
                    className="bg-slate-950 hover:bg-rose-950/40 border border-slate-850 text-rose-500 text-xs py-1.5 rounded font-mono font-bold active:scale-95 transition-all text-center flex items-center justify-center cursor-pointer"
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditPinInput(prev => (prev + '0').slice(0, 4))}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-white text-xs py-1.5 rounded font-mono font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditPinInput('')}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 text-[10px] py-1.5 rounded font-mono font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    C
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 uppercase block tracking-wider">Motivo de Anulación Obligatorio *</label>
                <textarea 
                  rows={2}
                  required
                  value={auditMotivo}
                  onChange={e => setAuditMotivo(e.target.value)}
                  placeholder="E.g., Incoherencia de fletes o solicitud del cliente..."
                  className="bg-slate-950 border border-rose-500/20 text-white rounded p-2 w-full outline-none resize-none font-sans"
                />
              </div>

              {auditError && (
                <p className="text-rose-500 text-[10px] font-bold bg-rose-500/10 p-2 rounded">
                  {auditError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-500/10">
              <button 
                type="button" 
                onClick={() => setAuditTargetId(null)}
                className="bg-slate-900 border border-slate-800 text-slate-350 text-[10px] px-3.5 py-2 rounded"
              >
                CANCELAR
              </button>
              <button 
                type="button" 
                onClick={handleConfirmCancellation}
                className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] tracking-wider px-4 py-2 rounded"
              >
                COMPROMETER ANULACIÓN
              </button>
            </div>
            
            <p className="text-[8px] text-slate-500 text-center">Master PIN por defecto para revisión: <strong>1234</strong></p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🚚 MODAL: CARRIER OPERATIONS FORM                                         */}
      {/* ========================================================================= */}
      {isCarrierFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[12000] flex items-center justify-center p-4">
          <form onSubmit={handleSaveCarrier} className="bg-hud-card border-2 border-hud-accent/60 p-6 rounded-xl max-w-sm w-full space-y-4 font-mono text-xs">
            <h3 className="text-xs font-display font-extrabold text-hud-accent tracking-widest uppercase border-b border-sky-950 pb-2">
              {editingCarrierId ? 'Editar Carrier' : 'Añadir Transportadora'}
            </h3>

            <div className="space-y-2">
              <div>
                <label className="text-[9px] text-slate-400 block uppercase">Razón Social</label>
                <input 
                  type="text" required value={carrierName} onChange={e => setCarrierName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block uppercase">NIT</label>
                <input 
                  type="text" required value={carrierNit} onChange={e => setCarrierNit(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block uppercase">Ciudad (Sede Central) *</label>
                <input 
                  type="text" required value={carrierSede} onChange={e => setCarrierSede(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none"
                  placeholder="E.g., Cali, Yumbo, Bogotá"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block uppercase">Dirección de Sede</label>
                <input 
                  type="text" value={carrierDir} onChange={e => setCarrierDir(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none"
                  placeholder="E.g., Calle 15 #2A-44"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block uppercase">Contacto Encargado *</label>
                <input 
                  type="text" required value={carrierCont} onChange={e => setCarrierCont(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block uppercase">Teléfono Celular *</label>
                <input 
                  type="text" required value={carrierTel} onChange={e => setCarrierTel(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block uppercase">Correo Electrónico (Email) *</label>
                <input 
                  type="email" required value={carrierMail} onChange={e => setCarrierMail(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none"
                  placeholder="E.g., operaciones@transportadora.com"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block uppercase">Tarifa costo predeterminado ($)</label>
                <input 
                  type="number" required value={carrierCost} onChange={e => setCarrierCost(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-hud-green font-bold p-2 rounded w-full outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
              <button type="button" onClick={() => setIsCarrierFormOpen(false)} className="bg-slate-900 text-slate-350 p-2 rounded text-[10px]">Cerrar</button>
              <button type="submit" className="bg-hud-accent text-slate-950 font-bold px-4 py-2 rounded text-[10px]">GUARDAR SOCIO</button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🏢 MODAL: CUSTOMER SPECIFICATION FORM                                     */}
      {/* ========================================================================= */}
      {isCustomerFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[12000] flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveCustomer} className="bg-[#080d19] border-2 border-hud-green/60 p-6 rounded-xl max-w-lg w-full space-y-4 font-mono text-xs my-8 text-left">
            <h3 className="text-xs font-display font-extrabold text-hud-green tracking-widest uppercase border-b border-sky-950 pb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {editingCustomerId ? 'Editar Registro Cliente' : 'Añadir Registro Cliente'}
            </h3>

            <div className="space-y-3">
              {/* Razón Social */}
              <div>
                <label className="text-[9px] text-[#00ffa3] block uppercase font-bold tracking-wider">Nombre / Razón Social *</label>
                <input 
                  type="text" required value={custName} onChange={e => setCustName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none font-bold"
                  placeholder="E.g., ALMACENES ÉXITO S.A."
                />
              </div>

              {/* Nit y Ciudad Sede */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Matricula Nit</label>
                  <input 
                    type="text" value={custNit} onChange={e => setCustNit(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none"
                    placeholder="E.g., 890.900.608-9"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[#00ffa3] block uppercase font-bold tracking-wider">Ciudad Sede *</label>
                  <input 
                    type="text" required value={custCiudad} onChange={e => setCustCiudad(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none font-bold"
                    placeholder="E.g., Bogotá, Medellín"
                  />
                </div>
              </div>

              {/* Dirección exacta descarga */}
              <div>
                <label className="text-[9px] text-[#00ffa3] block uppercase font-bold tracking-wider">Dirección exacta descarga *</label>
                <input 
                  type="text" required value={custDir} onChange={e => setCustDir(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none font-bold"
                  placeholder="E.g., Av. El Dorado #103-2"
                />
              </div>

              {/* Contacto Encargado y Correo Electrónico */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Contacto Encargado</label>
                  <input 
                    type="text" value={custCont} onChange={e => setCustCont(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white p-2 text-xs rounded w-full outline-none"
                    placeholder="E.g., Juan Carlos Pérez"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Correo Electrónico (Email)</label>
                  <input 
                    type="email" value={custEmail} onChange={e => setCustEmail(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white p-2 text-xs rounded w-full outline-none"
                    placeholder="E.g., contacto@cliente.com"
                  />
                </div>
              </div>

              {/* Celular */}
              <div>
                <label className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Teléfono Celular / Número</label>
                <input 
                  type="text" value={custCel} onChange={e => setCustCel(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 text-xs rounded w-full outline-none"
                  placeholder="E.g., 315 440 2201"
                />
              </div>

              {/* Malla de Entrega Checkboxes Section */}
              <div className="bg-slate-950/60 border border-slate-900 rounded-lg p-3.5 space-y-3.5">
                <span className="text-[10px] text-hud-green font-display font-extrabold uppercase tracking-widest block">
                  Malla de Entregas
                </span>
                
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1">
                  {[
                    { key: 'Lunes', label: 'Lun' },
                    { key: 'Martes', label: 'Mar' },
                    { key: 'Miércoles', label: 'Mié' },
                    { key: 'Jueves', label: 'Jue' },
                    { key: 'Viernes', label: 'Vie' },
                    { key: 'Sábado', label: 'Sáb' },
                  ].map(day => (
                    <label key={day.key} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isMallaDaySelected(day.key)}
                        onChange={() => toggleMallaDay(day.key)}
                        className="rounded border border-sky-800 text-hud-green focus:ring-hud-green w-4 h-4 bg-slate-950 cursor-pointer"
                      />
                      <span className="text-white text-xs font-bold font-sans">{day.label}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-1">
                  <div className="flex items-center gap-2 p-2 bg-slate-900/40 border border-slate-800 rounded-lg max-w-[180px]">
                    <input
                      type="checkbox"
                      id="malla-mercancia"
                      checked={isMallaDaySelected('Mercancía Lista')}
                      onChange={() => toggleMallaDay('Mercancía Lista')}
                      className="rounded border border-sky-800 text-hud-green focus:ring-hud-green w-4 h-4 bg-slate-950 cursor-pointer"
                    />
                    <label htmlFor="malla-mercancia" className="text-white text-xs font-bold font-sans cursor-pointer flex items-center gap-1.5 select-none">
                      <span>📦</span> Mercancía Lista
                    </label>
                  </div>
                </div>
                
                {/* Visual state text info */}
                <div className="text-[9px] text-[#476a8a] font-mono leading-none">
                  VALOR DE MALLA: <strong className="text-white">{custMalla || '(Sin registrar)'}</strong>
                </div>
              </div>

              {/* ¿Requiere Cita de Entrega? */}
              <div className="bg-slate-950/40 border border-slate-900 rounded-lg p-3 space-y-2">
                <label className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">¿Requiere Cita para entrega en muelle?</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCustCita('SI')}
                    className={`flex-1 py-1.5 rounded font-sans font-bold text-xs border transition-all cursor-pointer text-center ${
                      custCita === 'SI'
                        ? 'bg-hud-accent/20 border-hud-accent text-hud-accent shadow-[0_0_8px_rgba(0,229,255,0.15)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    SÍ, Requiere Cita
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustCita('NO')}
                    className={`flex-1 py-1.5 rounded font-sans font-bold text-xs border transition-all cursor-pointer text-center ${
                      custCita === 'NO'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    NO Requiere Cita
                  </button>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Observaciones Logísticas</label>
                <textarea 
                  rows={2}
                  value={custObs} onChange={e => setCustObs(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white p-2 rounded w-full outline-none font-sans resize-none"
                  placeholder="Observaciones de muelle, restricciones de horarios o vehículos..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
              <button type="button" onClick={() => setIsCustomerFormOpen(false)} className="bg-slate-900 hover:bg-slate-850 text-slate-350 p-2 text-[10px] rounded cursor-pointer">Cerrar</button>
              <button type="submit" className="bg-hud-green hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-[10px] cursor-pointer transition-all">GUARDAR CLIENTE</button>
            </div>
          </form>
        </div>
      )}


      {/* Universal Intelligent PDF parsed result modal overlay */}
      {parsedPdfData && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0b0f19] border border-hud-border rounded-xl p-5 max-w-xl w-full space-y-4 shadow-2xl relative animate-fade-in text-white">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-display font-extrabold text-hud-green tracking-wider uppercase flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-hud-green" /> Escaneo de Documento Exitoso!
              </h3>
              <button onClick={() => setParsedPdfData(null)} className="text-slate-400 hover:text-white font-mono font-bold text-sm">✕</button>
            </div>

            <div className="bg-[#030610] p-3 rounded border border-slate-950 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 font-semibold">Tipo de Documento:</span>
              <span className={`text-[10.5px] uppercase font-mono px-2 py-1 rounded font-bold border ${
                parsedPdfData.tipoDocumento === 'FACTURA_PROVISION' 
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                  : 'bg-hud-accent/10 text-hud-accent border-hud-accent/20'
              }`}>
                {parsedPdfData.tipoDocumento === 'FACTURA_PROVISION' ? 'Provisión / Flete Transportadora' : 'Pedido / Orden de Compra Cliente'}
              </span>
            </div>

            {parsedPdfData.tipoDocumento === 'FACTURA_PROVISION' ? (
              /* --- RENDER FOR TRANS CARRIER PROVISION --- */
              <div className="space-y-4 text-white">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono bg-slate-950/40 p-3 rounded border border-slate-900/60">
                  <div className="col-span-2 text-sky-455 text-[10px] uppercase tracking-widest border-b border-slate-900/40 pb-1 mb-1 font-bold">Carga de Provisión Operativa</div>
                  <div><span className="text-slate-400 block text-[9.5px]">Factura Provisión (FP):</span> <strong className="text-rose-400 font-bold text-sm">{parsedPdfData.provision || 'S/N'}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px]">Transportadora:</span> <strong className="text-white">{parsedPdfData.transportadora}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] font-sans">Valor Flete Extraído:</span> <strong className="text-rose-400 font-bold">${(parsedPdfData.flete || 0).toLocaleString('es-CO')}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] mb-0.5">Orden de Compra Ref:</span> <strong className="text-white">OC: {parsedPdfData.oc || 'N/A'}</strong></div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-mono block font-bold">Vincular a Orden en el Sistema:</label>
                  {pdfMatchingOrder ? (
                    <div className="bg-hud-green/10 border border-hud-green/30 rounded p-2.5 flex items-center justify-between text-xs font-mono">
                      <div className="space-y-0.5">
                        <span className="text-sky-400 block text-[9px] uppercase font-bold">Orden Coincidente Sugerida</span>
                        <div><strong className="text-white">{pdfMatchingOrder.id}</strong> - {pdfMatchingOrder.cliente} ({pdfMatchingOrder.ciudad})</div>
                        <span className="text-[9.5px] block text-slate-400">PV: {pdfMatchingOrder.pv} | Flete anterior: ${pdfMatchingOrder.flete.toLocaleString('es-CO')}</span>
                      </div>
                      <span className="text-[10px] bg-hud-green/20 text-hud-green border border-hud-green/30 px-1.5 py-0.5 rounded font-black font-mono">SÚPER COINCIDENCIA</span>
                    </div>
                  ) : (
                    <div className="bg-rose-500/5 border border-rose-500/25 rounded p-2.5 text-xs text-rose-300 font-mono">
                      ⚠ No se detectó ninguna orden abierta con el número OC "{parsedPdfData.oc || 'S/N'}" o PV "{parsedPdfData.pv || 'S/N'}".
                    </div>
                  )}

                  <div className="pt-1 space-y-1">
                    <label className="text-[10px] text-slate-400 block font-mono uppercase">Seleccionar Orden manualmente para vincular flete:</label>
                    <select
                      value={pdfSelectedMatchOrderId || (pdfMatchingOrder ? pdfMatchingOrder.id : '')}
                      onChange={e => setPdfSelectedMatchOrderId(e.target.value)}
                      className="bg-slate-950 border border-slate-900 rounded p-2.5 text-xs text-white outline-none w-full font-mono"
                    >
                      <option value="">-- Buscar y seleccionar orden manual --</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          [{o.id}] {o.cliente.substring(0,35)} - {o.ciudad} ({o.oc ? `OC: ${o.oc}` : `PV: ${o.pv}`}) - Flete: ${o.flete.toLocaleString('es-CO')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button 
                    type="button"
                    onClick={() => setParsedPdfData(null)}
                    className="flex-1 border border-slate-800 hover:bg-slate-900 text-slate-400 text-xs px-4 py-2.5 rounded-lg font-mono font-bold cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button 
                    type="button"
                    disabled={!pdfSelectedMatchOrderId && !pdfMatchingOrder}
                    onClick={handleUpdateOrderFromProvisionPdf}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono uppercase tracking-wider cursor-pointer font-bold"
                  >
                    Registrar Flete Provisión
                  </button>
                </div>
              </div>
            ) : (
              /* --- RENDER FOR CLIENT ORDERS --- */
              <div className="space-y-4 text-white">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono bg-slate-950/40 p-3 rounded border border-slate-900/60">
                  <div><span className="text-slate-400 block text-[9.5px]">Orden de Compra (OC):</span> <strong className="text-white">{parsedPdfData.oc || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px]">Orden de Venta (PV):</span> <strong className="text-white">{parsedPdfData.pv || 'N/A'}</strong></div>
                  <div className="col-span-2"><span className="text-slate-400 block text-[9.5px]">Cliente detectado:</span> <strong className="text-hud-accent font-bold text-sm">{resolveCustomerFromPdf(parsedPdfData.cliente)}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px]">Cajas físicas:</span> <strong className="text-hud-green font-bold text-sm">{parsedPdfData.cajas}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px]">Peso en Kilogramos:</span> <strong className="text-hud-green font-bold text-sm">{parsedPdfData.peso} kg</strong></div>
                  <div className="col-span-2"><span className="text-slate-400 block text-[9.5px]">Ciudad Sede Destino:</span> <strong className="text-hud-accent font-bold">{parsedPdfData.ciudad}</strong></div>
                  {parsedPdfData.factura && (
                    <div className="col-span-2"><span className="text-slate-400 block text-[9.5px]">Factura de Venta Cliente:</span> <strong className="text-[#ffaa00] font-bold">{parsedPdfData.factura}</strong></div>
                  )}
                  <div className="col-span-2 pt-2 border-t border-slate-900"><span className="text-slate-400 text-sm">Valor de la Venta (COP):</span> <strong className="text-xl text-hud-green font-display font-extrabold block mt-0.5">${(parsedPdfData.venta || 0).toLocaleString('es-CO')}</strong></div>
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button 
                    type="button"
                    onClick={() => setParsedPdfData(null)}
                    className="flex-1 border border-slate-800 hover:bg-slate-900 text-slate-400 text-xs px-4 py-2.5 rounded-lg font-mono font-bold cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button 
                    type="button"
                    onClick={handleCreateOrderFromPdf}
                    className="flex-1 bg-hud-green hover:bg-emerald-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-lg transition-colors font-mono uppercase tracking-wider cursor-pointer"
                  >
                    Generar Orden Digital
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Universal parsed error toast notification */}
      {pdfParsingError && (
        <div className="fixed bottom-6 left-6 z-[25000] bg-rose-950/95 border border-rose-500/50 p-4 rounded-xl shadow-2xl max-w-sm w-full font-mono text-xs flex items-start gap-3 backdrop-blur-md text-rose-300 animate-fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500 animate-pulse" />
          <div className="flex-1 space-y-1">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Error de Lectura de PDF</h4>
            <p className="text-[10.5px] leading-snug">{pdfParsingError}</p>
          </div>
          <button onClick={() => setPdfParsingError(null)} className="text-slate-400 hover:text-white font-mono text-sm leading-none font-bold">✕</button>
        </div>
      )}

      {/* Universal Successful parsing toast notification */}
      {pSuccessToast && (
        <div className="fixed bottom-6 right-6 z-[25000] bg-slate-950/95 border-2 border-hud-green p-4 rounded-xl shadow-2xl max-w-sm w-full font-mono text-xs animate-fade-in flex items-start gap-3 backdrop-blur-md text-white">
          <span className="text-xl text-hud-green">⚡</span>
          <div className="space-y-1">
            <h4 className="font-bold text-hud-green uppercase tracking-wide text-[11px]">{pSuccessToast.title}</h4>
            <p className="text-slate-200 text-[10.5px] leading-snug">{pSuccessToast.message}</p>
          </div>
          <button onClick={() => setPSuccessToast(null)} className="text-slate-500 hover:text-white font-mono text-xs font-bold ml-auto">✕</button>
        </div>
      )}


    </div>
  );
}
