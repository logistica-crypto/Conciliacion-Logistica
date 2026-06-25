/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import * as XLSX from 'xlsx';
import { 
  FileCheck, ShieldAlert, Award, FileSpreadsheet, CheckSquare, 
  MapPin, Printer, Clipboard, DollarSign, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';

interface ProvisionesModuleProps {
  orders: Order[];
  onUpdateOrder: (order: Order) => void;
}

export default function ProvisionesModule({ orders, onUpdateOrder }: ProvisionesModuleProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [provisionFilter, setProvisionFilter] = useState<'Pendiente' | 'Facturado' | ''>('Pendiente');
  const [searchTerm, setSearchTerm] = useState('');
  const [provisionInvoiceInput, setProvisionInvoiceInput] = useState('');
  
  // Pagination
  const [provisionPage, setProvisionPage] = useState(1);
  const itemsPerPage = 12;

  // Voucher preview states
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [isSummaryView, setIsSummaryView] = useState(false);

  // Filtered orders for Provision checking
  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => o.estado !== 'Anulado' && o.estado !== 'Pendiente');
    
    if (provisionFilter === 'Pendiente') {
      // Pending assignment means has NO provision invoice written
      result = result.filter(o => !o.provision);
    } else if (provisionFilter === 'Facturado') {
      // Billed or has a written provision invoice
      result = result.filter(o => !!o.provision);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(o => 
        o.id.toLowerCase().includes(term) ||
        o.cliente.toLowerCase().includes(term) ||
        o.transportadora.toLowerCase().includes(term) ||
        (o.provision && o.provision.toLowerCase().includes(term))
      );
    }

    return result;
  }, [orders, provisionFilter, searchTerm]);

  const totalProvisionPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  }, [filteredOrders, itemsPerPage]);

  const paginatedOrdersForTable = useMemo(() => {
    const startIndex = (provisionPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, provisionPage, itemsPerPage]);

  const exportProvisionesToCSV = () => {
    const headers = ["Flete ID", "Cliente", "Socio Transportador", "Destino", "Costo Flete", "Factura Provisión (FP)"];
    const rows = filteredOrders.map(o => [
      o.id,
      o.cliente,
      o.transportadora,
      o.ciudad,
      o.flete,
      o.provision || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría Provisiones");
    XLSX.writeFile(wb, `auditoria_provisiones_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredOrders.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Assign Bulk Factura Provisión
  const handleAssignBulkProvision = () => {
    if (!provisionInvoiceInput.trim() || selectedIds.length === 0) return;

    selectedIds.forEach(id => {
      const existing = orders.find(o => o.id === id);
      if (existing) {
        onUpdateOrder({
          ...existing,
          provision: provisionInvoiceInput.trim()
        });
      }
    });

    setSelectedIds([]);
    setProvisionInvoiceInput('');
  };

  // Calculations for active selection for the voucher
  const voucherData = useMemo(() => {
    const selectedOrders = orders.filter(o => selectedIds.includes(o.id));
    const totalFlete = selectedOrders.reduce((sum, o) => sum + o.flete, 0);
    // Find common carrier or default
    const carrier = selectedOrders.length > 0 ? selectedOrders[0].transportadora : "Operadores Varios";
    return {
      orders: selectedOrders,
      totalFlete,
      carrier,
      date: new Date().toLocaleDateString('es-CO')
    };
  }, [orders, selectedIds]);

  const triggerPrintVoucher = () => {
    const original = document.title;
    document.title = `SOPORTE_PROVISION_PAGO_${voucherData.carrier.replace(/\s+/g, '_')}`;
    window.print();
    document.title = original;
  };

  return (
    <div className="space-y-6 animate-fade-in print:bg-white print:text-black">
      <div className="sticky -top-6 bg-[#040814] pt-6 pb-4 z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-900 print:hidden shadow-lg">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-extrabold text-hud-accent tracking-widest flex items-center gap-2 uppercase">
            <CheckSquare className="w-5 h-5" /> Auditoría de Provisiones del Operador
          </h2>
          <p className="text-xs text-slate-400">Conciliación tributaria de fletes facturados por distribuidores</p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button 
              onClick={() => setIsVoucherOpen(true)}
              className="bg-hud-green text-slate-950 font-black font-mono tracking-widest px-4 py-2 text-xs rounded-lg cursor-pointer hover:bg-hud-green/80 flex items-center gap-2 shadow"
            >
              📋 Ver Soporte de Pago
            </button>
          )}
        </div>
      </div>

      {/* Advanced Provision Bar Filters */}
      <div className="bg-hud-card border border-hud-border/40 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          {/* State select filter */}
          <select 
            value={provisionFilter}
            onChange={e => { setProvisionFilter(e.target.value as any); setSelectedIds([]); setProvisionPage(1); }}
            className="bg-slate-950 border border-slate-800 text-xs text-white px-2.5 py-1.5 rounded outline-none w-full md:w-44"
          >
            <option value="Pendiente">Fletes Despachados (Pendientes FP)</option>
            <option value="Facturado">Conciliados (Con Provisión)</option>
            <option value="">Mostrar Historial Completo</option>
          </select>

          {/* Search keyword input */}
          <input 
            type="text" 
            placeholder="Buscar por cliente, transportadora o FP..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setSelectedIds([]); setProvisionPage(1); }}
            className="bg-slate-950 border border-slate-800 text-xs text-white px-3 py-1.5 rounded outline-none w-full md:w-64"
          />
        </div>

        {/* Mass invoice code assign block */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-950/80 p-1 border border-slate-800 rounded-lg w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Factura Provisión (FP)" 
              value={provisionInvoiceInput}
              onChange={e => setProvisionInvoiceInput(e.target.value)}
              className="bg-black text-xs text-[#00ffa3] font-bold font-mono px-3 py-1 rounded border border-hud-green/30 outline-none w-full md:w-40"
            />
            <button 
              onClick={handleAssignBulkProvision}
              className="bg-[#00ffa3] hover:bg-hud-green/85 text-slate-100 px-4 py-1 text-xs font-mono font-black tracking-widest rounded"
            >
              ASIGNAR
            </button>
          </div>
        )}
      </div>

      {/* Table grid displaying matching items */}
      <div className="bg-hud-card border border-hud-border/50 rounded-lg overflow-hidden shadow-xl print:hidden">
        {/* Top-Left pagination & export block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/40 border-b border-hud-border/30 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-4">
            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setProvisionPage(1)}
                disabled={provisionPage === 1}
                className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                title="Primera página"
              >
                &laquo;
              </button>
              <button
                type="button"
                onClick={() => setProvisionPage(p => Math.max(1, p - 1))}
                disabled={provisionPage === 1}
                className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-hud-accent disabled:opacity-20 cursor-pointer text-xs flex items-center"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              
              <span className="text-hud-accent font-bold px-2">
                PÁG. {provisionPage} / {totalProvisionPages}
              </span>

              <button
                type="button"
                onClick={() => setProvisionPage(p => Math.min(totalProvisionPages, p + 1))}
                disabled={provisionPage === totalProvisionPages}
                className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-hud-accent disabled:opacity-20 cursor-pointer text-xs flex items-center"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setProvisionPage(totalProvisionPages)}
                disabled={provisionPage === totalProvisionPages}
                className="px-2 py-1 rounded border border-slate-850 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-xs"
                title="Última página"
              >
                &raquo;
              </button>
            </div>

            {/* Export block */}
            <button
              onClick={exportProvisionesToCSV}
              className="bg-hud-accent/10 border border-hud-accent/30 text-hud-accent hover:bg-hud-accent/20 px-3 py-1 rounded text-[10px] font-mono tracking-wider flex items-center gap-1.5 cursor-pointer uppercase font-bold transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-hud-accent" /> Exportar a Excel
            </button>
          </div>

          <div className="text-slate-400 text-xs">
            Mostrando <strong className="text-white">{filteredOrders.length === 0 ? 0 : (provisionPage - 1) * itemsPerPage + 1}</strong> a <strong className="text-white">{Math.min(provisionPage * itemsPerPage, filteredOrders.length)}</strong> de <strong className="text-hud-accent">{filteredOrders.length}</strong> provisiones
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#030610] text-[#476a8a] border-b border-hud-border/40 text-[10px] tracking-widest uppercase">
              <tr>
                <th className="p-4" style={{ width: '40px' }}>
                  <input 
                    type="checkbox"
                    onChange={e => toggleSelectAll(e.target.checked)}
                    checked={filteredOrders.length > 0 && paginatedOrdersForTable.every(o => selectedIds.includes(o.id))}
                    className="accent-hud-green"
                  />
                </th>
                <th className="p-4">Código Origen</th>
                <th className="p-4">Cliente / Sucursal Destino</th>
                <th className="p-4">Socio Transportador</th>
                <th className="p-4 text-center">Costo Flete</th>
                <th className="p-4">Factura Provisión (FP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 text-slate-350">
              {paginatedOrdersForTable.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-mono text-xs">
                    -- No se disponen de registros conciliables con estos parámetros --
                  </td>
                </tr>
              ) : (
                paginatedOrdersForTable.map(order => {
                  const isChecked = selectedIds.includes(order.id);
                  return (
                    <tr key={order.id} className={`hover:bg-slate-900/10 ${isChecked ? 'bg-hud-accent/5' : ''}`}>
                      <td className="p-4">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="accent-hud-green"
                        />
                      </td>
                      <td className="p-4 font-bold text-white">{order.id}</td>
                      <td className="p-4 font-sans font-medium text-white max-w-xs truncate">
                        {order.cliente} <span className="text-[10px] text-slate-400 block font-mono">Destino: {order.ciudad}</span>
                      </td>
                      <td className="p-4 font-sans text-slate-300">{order.transportadora}</td>
                      <td className="p-4 text-center font-bold text-hud-green">
                        ${order.flete.toLocaleString('es-CO')}
                      </td>
                      <td className="p-4">
                        {order.provision ? (
                          <span className="text-[#00ffa3] font-bold font-mono">{order.provision}</span>
                        ) : (
                          <span className="text-[9px] bg-[#ff9100]/10 border border-[#ff9100]/30 text-[#ff9100] px-2 py-0.5 rounded font-mono">Falta FP</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Itemized printable Payment Voucher overlay modal */}
      {isVoucherOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[12000] flex items-center justify-center p-4 print:relative print:inset-auto print:bg-white print:p-0">
          <div className="bg-[#030610] print:bg-white border border-hud-green print:border-none rounded-xl max-w-3xl w-full p-6 space-y-5 shadow-2xl print:shadow-none max-h-[95vh] overflow-y-auto print:max-h-none print:overflow-visible">
            
            {/* Header controls inside overlay (hidden during print window) */}
            <div className="flex items-center justify-between border-b border-sky-950 pb-3 print:hidden">
              <h3 className="text-sm font-display font-extrabold text-hud-green tracking-wider uppercase">
                Soporte de Liquidación de Pago consolidado
              </h3>

              <div className="flex items-center gap-3">
                {/* Summary view toggle */}
                <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer text-slate-400">
                  <input 
                    type="checkbox" 
                    checked={isSummaryView} 
                    onChange={e => setIsSummaryView(e.target.checked)} 
                    className="accent-hud-green"
                  />
                  Vista Resumida
                </label>

                <button onClick={triggerPrintVoucher} className="bg-hud-accent text-slate-950 px-3 py-1 font-bold text-[10px] tracking-wider rounded">
                  🖨️ IMPRIMIR
                </button>
                <button onClick={() => setIsVoucherOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
              </div>
            </div>

            {/* Printable Document Sheet block */}
            <div className="space-y-4 print:space-y-6 print:text-black">
              <div className="border-b border-hud-green pb-3 flex justify-between items-end">
                <div className="space-y-1">
                  <h2 className="text-base font-display font-extrabold text-white print:text-black">LATIN PRODUCTS SAS</h2>
                  <div className="text-[10px] font-mono text-slate-400 print:text-gray-600">NIT: 800.225.074-3</div>
                  <div className="text-[10px] font-mono text-slate-400 print:text-gray-600">Acopi-Yumbo, Valle del Cauca, CO</div>
                </div>

                <div className="text-right">
                  <h3 className="text-xs font-mono font-black text-[#00ffa3] print:text-black tracking-widest uppercase">
                    Liquidación de Provisiones FP
                  </h3>
                  <div className="text-[9px] font-mono text-slate-400 print:text-gray-600">Emisión: {voucherData.date}</div>
                </div>
              </div>

              {/* Box Details */}
              <div className="bg-slate-950/60 print:bg-gray-100 border border-slate-900 print:border-gray-300 rounded p-4 grid grid-cols-2 gap-4">
                <div className="text-xs">
                  <span className="text-[9px] text-[#476a8a] block font-mono font-bold tracking-widest uppercase">Operador de fletes beneficial</span>
                  <strong className="text-white print:text-black text-sm uppercase">{voucherData.carrier}</strong>
                </div>
                <div className="text-xs text-right">
                  <span className="text-[9px] text-[#476a8a] block font-mono font-bold tracking-widest uppercase">Lote consolidado</span>
                  <strong className="text-white print:text-black text-sm uppercase">{selectedIds.length} despachos listados</strong>
                </div>
              </div>

              {/* Table details */}
              <div className="border border-slate-900 print:border-gray-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#030610] print:bg-gray-200 text-[#476a8a] print:text-gray-700 border-b border-sky-950 font-bold">
                    <tr>
                      <th className="p-3">Código PV</th>
                      <th className="p-3">Cliente Destino</th>
                      <th className="p-3 text-right">Flete Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 print:divide-gray-200">
                    {isSummaryView ? (
                      <tr>
                        <td colSpan={2} className="p-3 text-slate-400 font-sans italic">
                          Resumen consolidador de fletes logísticos... ({selectedIds.length} órdenes)
                        </td>
                        <td className="p-3 text-right text-hud-green font-bold">${voucherData.totalFlete.toLocaleString('es-CO')}</td>
                      </tr>
                    ) : (
                      voucherData.orders.map(o => (
                        <tr key={o.id} className="text-slate-350 print:text-gray-800">
                          <td className="p-3 font-bold">{o.id} <span className="text-[9px] block text-slate-500">PV: {o.pv}</span></td>
                          <td className="p-3 font-sans">{o.cliente} <span className="text-[9px] block font-mono text-slate-500">FP assigned: {o.provision || "Completo"}</span></td>
                          <td className="p-3 text-right text-hud-green font-bold">${o.flete.toLocaleString('es-CO')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-hud-green/5 print:bg-gray-100 font-extrabold border-t border-hud-green">
                      <td colSpan={2} className="p-3 text-right text-hud-green uppercase tracking-wider font-display font-semibold">Total Liquidado a Liquidar:</td>
                      <td className="p-3 text-right text-hud-green font-display font-black text-sm">
                        ${voucherData.totalFlete.toLocaleString('es-CO')} COP
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-2 gap-12 font-mono text-[10px] text-center text-slate-450 print:text-gray-600">
                <div className="border-t border-slate-800 print:border-gray-500 pt-2 space-y-1">
                  <strong>Andrés Restrepo</strong>
                  <p className="text-[8px]">ÁREA DE LOGÍSTICA - ELABORÓ</p>
                </div>
                <div className="border-t border-slate-800 print:border-gray-500 pt-2 space-y-1">
                  <strong>Mesa Contable SAS</strong>
                  <p className="text-[8px]">REVISIÓN Y AUTORIZACIÓN DE PAGO</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
