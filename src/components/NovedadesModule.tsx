/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Novedad } from '../types';
import { 
  Plus, Search, Eye, Filter, Calendar, User, Tag, 
  Settings, CheckCircle, AlertTriangle, HelpCircle, FileText, Image as ImageIcon, MessageSquare,
  Edit2, Trash2, Bell
} from 'lucide-react';
import { 
  sendPushNotification, 
  requestNotificationPermission, 
  getNotificationPermission, 
  isNotificationSupported,
  checkAndNotifyDueEvents
} from '../notificationService';

interface NovedadesModuleProps {
  novedades: Novedad[];
  onAddNovedad: (novedad: Novedad) => void;
  onUpdateNovedad: (novedad: Novedad) => void;
  onDeleteNovedad: (id: string) => void;
}

export default function NovedadesModule({ novedades, onAddNovedad, onUpdateNovedad, onDeleteNovedad }: NovedadesModuleProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingNovedadId, setEditingNovedadId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [tipo, setTipo] = useState('🚨 Incidencia Crítica');
  const [pv, setPv] = useState('');
  const [cliente, setCliente] = useState('');
  const [responsable, setResponsable] = useState('');
  const [estado, setEstado] = useState<'Abierta' | 'En Proceso' | 'Cerrada'>('Abierta');
  
  const [permission, setPermission] = useState(getNotificationPermission());

  // Check for newly registered high-priority incidents
  useEffect(() => {
    checkAndNotifyDueEvents([], [], novedades);
    
    const interval = setInterval(() => {
      checkAndNotifyDueEvents([], [], novedades);
    }, 15000);

    return () => clearInterval(interval);
  }, [novedades]);

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    sendPushNotification("Avisos Activos", "Estás conectado al canal de alertas de incidencias de muelle.", "system");
  };

  const filteredNovedades = useMemo(() => {
    let result = [...novedades];
    const term = searchTerm.toLowerCase();

    if (term) {
      result = result.filter(n => 
        n.titulo.toLowerCase().includes(term) || 
        n.descripcion.toLowerCase().includes(term) ||
        n.pv.toLowerCase().includes(term) ||
        n.cliente.toLowerCase().includes(term) ||
        n.responsable.toLowerCase().includes(term)
      );
    }

    if (typeFilter) {
      result = result.filter(n => n.tipo === typeFilter);
    }

    if (stateFilter) {
      result = result.filter(n => n.estado === stateFilter);
    }

    return result.sort((a,b) => b.fecha.localeCompare(a.fecha));
  }, [novedades, searchTerm, typeFilter, stateFilter]);

  // Page split
  const totalPages = Math.max(1, Math.ceil(filteredNovedades.length / itemsPerPage));
  const paginated = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredNovedades.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredNovedades, currentPage]);

  const handleOpenNewForm = () => {
    setTitle('');
    setDesc('');
    setImgUrl('');
    setTipo('🚨 Incidencia Crítica');
    setPv('');
    setCliente('');
    setResponsable('');
    setEstado('Abierta');
    setEditingNovedadId(null);
    setIsOpenForm(true);
  };

  const handleStartEdit = (nov: Novedad) => {
    setTitle(nov.titulo);
    setDesc(nov.descripcion);
    setImgUrl(nov.imageLink || '');
    setTipo(nov.tipo);
    setPv(nov.pv || '');
    setCliente(nov.cliente || '');
    setResponsable(nov.responsable);
    setEstado(nov.estado);
    setEditingNovedadId(nov.id);
    setIsOpenForm(true);

    // Scroll to form smoothly
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handleCloseForm = () => {
    setTitle('');
    setDesc('');
    setImgUrl('');
    setTipo('🚨 Incidencia Crítica');
    setPv('');
    setCliente('');
    setResponsable('');
    setEstado('Abierta');
    setEditingNovedadId(null);
    setIsOpenForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingNovedadId) {
      const existing = novedades.find(n => n.id === editingNovedadId);
      onUpdateNovedad({
        id: editingNovedadId,
        titulo: title,
        descripcion: desc,
        imageLink: imgUrl,
        tipo,
        pv,
        cliente,
        responsable: responsable || "Auxiliar Logística",
        estado,
        fecha: existing ? existing.fecha : new Date().toISOString().split('T')[0]
      });
      sendPushNotification(
        "Novedad Actualizada", 
        `[${tipo}] ${cliente || 'Sin Cliente'}: "${title}" editado. Estado: ${estado}`, 
        "novedad"
      );
    } else {
      const newId = `NOV-${100 + novedades.length + 1}`;
      onAddNovedad({
        id: newId,
        titulo: title,
        descripcion: desc,
        imageLink: imgUrl,
        tipo,
        pv,
        cliente,
        responsable: responsable || "Auxiliar Logística",
        estado,
        fecha: new Date().toISOString().split('T')[0]
      });
      sendPushNotification(
        "🚨 Nueva Novedad Reportada", 
        `[${tipo}] ${cliente || 'Sin Cliente'}: "${title}" registrado por ${responsable || "auxiliar"}.`, 
        "novedad"
      );
    }

    handleCloseForm();
  };

  const toggleStatus = (nov: Novedad) => {
    const nextStates: Record<'Abierta' | 'En Proceso' | 'Cerrada', 'Abierta' | 'En Proceso' | 'Cerrada'> = {
      'Abierta': 'En Proceso',
      'En Proceso': 'Cerrada',
      'Cerrada': 'Abierta'
    };
    const nextStatus = nextStates[nov.estado];
    onUpdateNovedad({
      ...nov,
      estado: nextStatus
    });
    sendPushNotification(
      "Estado de Novedad Cambiado", 
      `"${nov.titulo}" cambió su estado de [${nov.estado}] a [${nextStatus}]`, 
      "novedad"
    );
  };

  const handlePageChange = (direction: number) => {
    setCurrentPage(prev => {
      const next = prev + direction;
      if (next < 1 || next > totalPages) return prev;
      return next;
    });
  };

  // Printable summary window
  const printHistory = () => {
    const original = document.title;
    document.title = "HISTORIAL_DE_NOVEDADES_LATIN_PRODUCTS";
    window.print();
    document.title = original;
  };

  return (
    <div className="space-y-6 animate-fade-in print:bg-white print:text-black">
      
      {/* Dynamic Push Notifications Permission Widget */}
      {permission !== 'granted' ? (
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-teal-955/30 border-2 border-hud-accent/25 p-4 rounded-xl text-xs text-slate-300 justify-between shadow-lg print:hidden">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-hud-accent animate-bounce" />
            <div className="space-y-0.5">
              <p className="font-bold text-white uppercase tracking-wider text-[11px]">¿Recibir Alertas de Incidencias en Tiempo Real?</p>
              <p className="text-[10px] text-slate-400">Activa el canal de notificaciones push para enterarte de inmediato al surgir averías, quejas u omisiones críticas.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="px-4 py-2 bg-hud-accent text-slate-950 font-black rounded-lg transition-all hover:scale-105 active:scale-95 text-[10px] uppercase tracking-wider cursor-pointer font-bold whitespace-nowrap"
          >
            Habilitar Alertas
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-slate-950/45 border border-slate-900 px-4 py-2 rounded-lg text-[9.5px] text-slate-400 print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Canal de Notificaciones Novedades Activo</span>
          </div>
          <button 
            type="button"
            onClick={() => sendPushNotification("Canal Novedades Activo", "Recibirás una notificación por cada novedad registrada o cambiada.", "novedad")} 
            className="text-[8.5px] hover:text-[#00ffa3] underline font-bold uppercase transition"
          >
            Enviar Prueba
          </button>
        </div>
      )}

      <div className="sticky -top-6 bg-[#040814] pt-6 pb-4 z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-900 print:hidden shadow-lg">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-extrabold text-hud-accent tracking-widest flex items-center gap-2 uppercase">
            <MessageSquare className="w-5 h-5" /> Registro y Diálogo de Novedades
          </h2>
          <p className="text-xs text-slate-400">Canal de incidencias, averías y depuración logística de muelle</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={printHistory}
            className="bg-slate-900 border border-slate-800 hover:border-hud-accent text-slate-350 text-xs font-mono font-bold tracking-wider px-4 py-2 rounded-lg cursor-pointer transition-all"
          >
            🖨️ Imprimir Historial
          </button>
          
          <button 
            onClick={handleOpenNewForm}
            className="bg-hud-accent hover:bg-hud-accent/80 text-slate-950 font-black font-mono tracking-widest px-5 py-2.5 text-xs rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Registrar Novedad
          </button>
        </div>
      </div>

      {/* New Event Form slider */}
      {isOpenForm && (
        <form onSubmit={handleSubmit} className="bg-hud-card border-2 border-hud-accent rounded-lg p-5 space-y-4 max-w-2xl mx-auto shadow-2xl print:hidden animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-display font-extrabold text-hud-accent tracking-widest uppercase">
              {editingNovedadId ? `Modificar Novedad ${editingNovedadId}` : 'Formular Nueva Novedad Logística'}
            </h3>
            <button type="button" onClick={handleCloseForm} className="text-slate-400 hover:text-white">✕</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] text-hud-accent font-mono font-bold tracking-widest block uppercase">Título de la incidencia *</label>
              <input 
                type="text" 
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="E.g., Retraso báscula Yumbo / Avería de caja"
                className="bg-slate-950/80 border border-slate-800 text-xs text-white rounded p-2.5 w-full outline-none focus:border-hud-accent"
              />
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-[10px] text-slate-400 font-mono tracking-widest block uppercase">Descripción formal detallada</label>
              <textarea 
                rows={3}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Describa tiempos, operarios vinculados y medidas adoptadas transitoriamente..."
                className="bg-slate-950/80 border border-slate-800 text-xs text-white rounded p-2.5 w-full outline-none focus:border-hud-accent resize-none font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono tracking-widest block uppercase">Categoría de Evento</label>
              <select 
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="bg-slate-950/85 border border-slate-800 text-xs text-white rounded p-2 w-full outline-none"
              >
                <option>🚨 Incidencia Crítica</option>
                <option>⚠️ Alerta Operativa</option>
                <option>📦 Problema de Mercancía</option>
                <option>🚚 Problema de Transporte</option>
                <option>💰 Problema de Facturación</option>
                <option>✅ Seguimiento / Acción</option>
                <option>🛠️ Reporte de Avería</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono tracking-widest block uppercase">Referencia PV / Guía</label>
              <input 
                type="text" 
                value={pv}
                onChange={e => setPv(e.target.value)}
                placeholder="E.g., 4500308925"
                className="bg-slate-950/80 border border-slate-800 text-xs text-white rounded p-2 w-full outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono tracking-widest block uppercase">Cliente Vinculado</label>
              <input 
                type="text" 
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                placeholder="E.g., ALMACENES ÉXITO S.A."
                className="bg-slate-950/80 border border-slate-800 text-xs text-white rounded p-2 w-full outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono tracking-widest block uppercase">Responsable Operativo</label>
              <input 
                type="text" 
                value={responsable}
                onChange={e => setResponsable(e.target.value)}
                placeholder="E.g., Eduardo López"
                className="bg-slate-950/80 border border-slate-800 text-xs text-white rounded p-2 w-full outline-none"
              />
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-[10px] text-slate-400 font-mono tracking-widest block uppercase">Vínculo de Foto / Registro de Avería (Opcional)</label>
              <input 
                type="url" 
                value={imgUrl}
                onChange={e => setImgUrl(e.target.value)}
                placeholder="https://imgur.com/image_averia.png"
                className="bg-slate-950/80 border border-slate-800 text-xs text-white rounded p-2 w-full outline-none focus:border-hud-accent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-900">
            <button 
              type="button" 
              onClick={handleCloseForm}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-350 px-4 py-2 rounded"
            >
              Cerrar Formulario
            </button>
            <button 
              type="submit" 
              className="bg-hud-accent hover:bg-hud-accent/80 text-slate-950 font-bold text-xs px-5 py-2 rounded"
            >
              {editingNovedadId ? 'Guardar Cambios' : 'Publicar Novedad y Registrar FP'}
            </button>
          </div>
        </form>
      )}

      {/* Advanced Filters */}
      <div className="bg-hud-card border border-hud-border/40 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar por titular, PV, responsable..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="bg-slate-950/80 border border-slate-800 text-xs text-white rounded pl-8 pr-3 py-1.5 w-full outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="bg-slate-950/80 border border-slate-800 text-xs text-white px-2.5 py-1.5 rounded outline-none w-full md:w-44"
          >
            <option value="">Todas las Categorías</option>
            <option>🚨 Incidencia Crítica</option>
            <option>⚠️ Alerta Operativa</option>
            <option>📦 Problema de Mercancía</option>
            <option>🚚 Problema de Transporte</option>
            <option>💰 Problema de Facturación</option>
            <option>✅ Seguimiento / Acción</option>
          </select>

          <select 
            value={stateFilter}
            onChange={e => { setStateFilter(e.target.value); setCurrentPage(1); }}
            className="bg-slate-950/80 border border-slate-800 text-xs text-white px-2.5 py-1.5 rounded outline-none w-full md:w-36"
          >
            <option value="">Todos los Estados</option>
            <option value="Abierta">🔴 Abierta</option>
            <option value="En Proceso">🟡 En Proceso</option>
            <option value="Cerrada">🟢 Cerrada</option>
          </select>
        </div>
      </div>

      {/* Cards List feed */}
      <div className="space-y-4 print:space-y-6">
        {paginated.length === 0 ? (
          <div className="bg-hud-card p-12 text-center text-xs text-slate-500 font-mono border border-slate-900 rounded-lg">
            -- No se disponen de registros para las directivas solicitadas --
          </div>
        ) : (
          paginated.map(nov => (
            <div 
              key={nov.id}
              className="bg-hud-card border border-hud-border/70 rounded-lg p-5 space-y-4 shadow-xl relative overflow-hidden"
            >
              {/* Type color ribbon identifier */}
              <div className={`absolute top-0 left-0 h-full w-1 ${
                nov.estado === 'Abierta' ? 'bg-rose-500' :
                nov.estado === 'En Proceso' ? 'bg-[#ff9100]' : 'bg-[#00ffa3]'
              }`}></div>

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 pl-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-neutral-400 font-mono font-bold">
                      {nov.id}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">
                      {nov.tipo}
                    </span>
                    {nov.pv && (
                      <span className="text-[9px] bg-sky-950/60 text-hud-accent px-1.5 py-0.2 rounded font-mono">
                        PV: {nov.pv}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-sans font-bold text-white print:text-black">
                    {nov.titulo}
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap print:hidden">
                  <button 
                    onClick={() => toggleStatus(nov)}
                    className={`text-[10px] font-mono font-extrabold px-3 py-1 rounded border cursor-pointer transition-colors ${
                      nov.estado === 'Abierta' ? 'bg-rose-500/10 border-rose-500 text-rose-500 hover:bg-rose-500/20' :
                      nov.estado === 'En Proceso' ? 'bg-[#ff9100]/10 border-[#ff9100] text-[#ff9100] hover:bg-[#ff9100]/20' :
                      'bg-hud-green/10 border-hud-green text-hud-green hover:bg-hud-green/20'
                    }`}
                  >
                    STATUS: {nov.estado === 'Abierta' ? '🔴 Abierta' : nov.estado === 'En Proceso' ? '🟡 En Proceso' : '🟢 Cerrada'}
                  </button>

                  <button
                    onClick={() => handleStartEdit(nov)}
                    className="p-1 px-2.5 rounded bg-slate-900 border border-slate-800 text-slate-350 hover:text-white hover:border-hud-accent text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    title="Editar esta novedad"
                  >
                    <Edit2 className="w-3 h-3 text-hud-accent" />
                    Editar
                  </button>

                  {confirmDeleteId === nov.id ? (
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-rose-600 animate-fade-in text-[10px]">
                      <span className="text-[9px] text-rose-500 font-bold px-1 uppercase">¿Eliminar?</span>
                      <button
                        onClick={() => {
                          onDeleteNovedad(nov.id);
                          setConfirmDeleteId(null);
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-mono font-black py-0.5 px-2 rounded cursor-pointer transition-colors"
                      >
                        Sí, Borrar
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="bg-slate-800 hover:bg-slate-705 text-slate-300 text-[9px] font-mono py-0.5 px-1.5 rounded cursor-pointer transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(nov.id)}
                      className="p-1 px-2.5 rounded bg-slate-900 border border-slate-800 text-slate-350 hover:text-rose-450 hover:border-rose-900 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                      title="Eliminar esta novedad"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              {/* Description message body */}
              <div className="text-xs text-slate-350 leading-relaxed font-sans pl-2 print:text-gray-800">
                {nov.descripcion}
              </div>

              {/* Photo attachments inline if url exists */}
              {nov.imageLink && (
                <div className="pl-2 flex items-center gap-2 text-xs font-mono text-hud-accent hover:underline cursor-pointer">
                  <ImageIcon className="w-4 h-4" />
                  <a href={nov.imageLink} target="_blank" rel="noreferrer">Ver Archivo / Planilla de Alerta Adjunta</a>
                </div>
              )}

              {/* Metadata block footer */}
              <div className="pt-3 border-t border-slate-900/60 pl-2 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-450">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Auditado por: <strong className="text-white print:text-black">{nov.responsable}</strong>
                  </span>
                  {nov.cliente && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-slate-500" />
                      Cliente: <strong className="text-white print:text-black">{nov.cliente}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reportado el: <strong>{nov.fecha}</strong></span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination component block for Novedades */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1.5 bg-slate-950 p-1 hover:border-slate-800 border border-slate-900 rounded-lg max-w-xs mx-auto print:hidden font-mono text-xs text-hud-accent">
          <button 
            onClick={() => handlePageChange(-1)} 
            disabled={currentPage === 1}
            className="px-3 py-1 bg-slate-900 disabled:opacity-30 rounded cursor-pointer"
          >
            ◀
          </button>
          <span className="px-2 font-bold font-mono">PAGINA {currentPage} / {totalPages}</span>
          <button 
            onClick={() => handlePageChange(1)} 
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-slate-900 disabled:opacity-30 rounded cursor-pointer"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
