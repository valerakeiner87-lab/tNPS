'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Mensaje {
  id: number;
  texto: string;
  esBot: boolean;
}

/** Base de conocimiento del asistente (determinista, sin IA) */
const BASE_CONOCIMIENTO: { keywords: string[]; respuesta: string }[] = [
  {
    keywords: ['tnps', 'nps', 'que es', 'significa'],
    respuesta:
      'El tNPS (Transacción Net Promoter Score) mide la satisfacción tras cada atención. Se calcula: tNPS = ((Promotores − Detractores) / Total) × 100. Promotores: 9–10, Pasivos: 7–8, Detractores: 0–6.',
  },
  {
    keywords: ['atc', 'puntos', 'moneda', 'billetera', 'saldo'],
    respuesta:
      'ATC es nuestra moneda interna: ganas +10 por promotor (+15 con racha), pierdes −1 por pasivo y −3/−5 según el tipo de detractor. El saldo inicial semanal es 50 ATC y se reinicia los domingos a las 23:59. Canjéalos en “Mi Billetera”.',
  },
  {
    keywords: ['cargar', 'archivo', 'excel', 'qualtrics', 'hc', 'tmo', 'subir'],
    respuesta:
      'Para cargar datos ve a la pestaña Carga: necesitas el Excel de Qualtrics (encuestas), el HC (hojas ACTIVOS y TRANSICIONES) y opcionalmente el TMO (hojas BD NEW y Activos1). Solo usuarios con correo corporativo pueden cargar.',
  },
  {
    keywords: ['alerta', 'agresivo', 'comentario', 'insulto'],
    respuesta:
      'La pestaña Alertas detecta comentarios agresivos por palabras clave (sin IA). Ejecuta "Ejecutar análisis" para procesar las encuestas cargadas. Los resultados se guardan automáticamente y aparecen como badge rojo en los asesores.',
  },
  {
    keywords: ['tmo', 'tiempo', 'manejo', '970'],
    respuesta:
      'El TMO (Tiempo Medio Operativo) se calcula: (Manejo_total / 1000) / Manejo. El límite es 970 segundos por interacción. Los asesores que lo superan se marcan en rojo en la pestaña TMO.',
  },
  {
    keywords: ['cuenta', 'contraseña', 'ingresar', 'login', 'documento', 'asesor'],
    respuesta:
      'Hay dos formas de ingresar: Asesor (login de red + número de documento, validado contra el HC) o Supervisor (correo corporativo + contraseña, o Google). Si no puedes entrar, verifica tus datos con tu supervisor.',
  },
  {
    keywords: ['cache', 'dexie', 'indexeddb', 'slow', 'lento', 'lecturas'],
    respuesta:
      'Usamos un caché local inteligente: la primera visita descarga todo, las siguientes leen del caché al instante y solo sincronizan cambios nuevos. Esto hace que la app sea muy rápida después de la primera carga.',
  },
  {
    keywords: ['canje', 'premio', 'regalo'],
    respuesta:
      'Para canjear premios: ve a “Mi Billetera” → pestaña Premios → elige uno que puedas pagar con tu saldo → confirma. Si el premio tiene auto-aprobación se aprueba al instante; si no, tu supervisor lo revisará.',
  },
  {
    keywords: ['apelacion', 'apelar', 'reclamar', 'detractor injusto'],
    respuesta:
      'Si un detractor quedó “indeterminado” (0 ATC), puedes apelar desde “Mi Billetera” → pestaña Apelaciones. Describe por qué no fue tu culpa y el supervisor lo resolverá.',
  },
  {
    keywords: ['podio', 'ranking', 'ganador', 'premio mensual'],
    respuesta:
      'Los podios (Global, por LOB y TV) muestran el top de asesores por tNPS con mínimo 3 encuestas. Revisa la pestaña Podio para ver los líderes de la semana.',
  },
  {
    keywords: ['hola', 'buenas', 'saludos', 'hey', 'buenos dias'],
    respuesta:
      '¡Hola! Soy el asistente de ATC Digital. Pregúntame sobre: tNPS, ATC, carga de archivos, alertas, TMO, canjes o el podio.',
  },
  {
    keywords: ['gracias', 'thanks', 'chao', 'adios'],
    respuesta: '¡Con gusto! Si necesitas algo más, aquí estaré. ¡Éxito en tus atenciones!',
  },
];

const MENSAJE_INICIAL: Mensaje = {
  id: 0,
  texto: '¡Hola! Soy el asistente de ATC Digital. ¿En qué te puedo ayudar? Pregúntame sobre tNPS, ATC, alertas, TMO, premios…',
  esBot: true,
};

export function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([MENSAJE_INICIAL]);
  const [entrada, setEntrada] = useState('');
  const idRef = useRef(1);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, abierto]);

  const enviar = () => {
    const texto = entrada.trim();
    if (!texto) return;

    const idUsuario = idRef.current++;
    setMensajes((m) => [...m, { id: idUsuario, texto, esBot: false }]);
    setEntrada('');

    // Buscar respuesta por keywords
    const normalizado = texto.toLowerCase();
    const coincidencia = BASE_CONOCIMIENTO.find((b) => b.keywords.some((k) => normalizado.includes(k)));

    setTimeout(() => {
      const idBot = idRef.current++;
      setMensajes((m) => [
        ...m,
        {
          id: idBot,
          texto:
            coincidencia?.respuesta ??
            'No tengo una respuesta para eso todavía. Prueba preguntando sobre: tNPS, ATC, carga de archivos, alertas, TMO, canjes o podios.',
          esBot: true,
        },
      ]);
    }, 500);
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente de ayuda'}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-claro-red text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
      >
        {abierto ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!abierto && (
          <span className="absolute inset-0 rounded-full border-2 border-claro-red animar-onda" aria-hidden />
        )}
      </button>

      {/* Ventana de chat */}
      {abierto && (
        <div className="fixed bottom-20 right-5 z-50 w-[min(92vw,360px)] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden animar-aparecer">
          <div className="header-claro text-white px-4 py-3">
            <p className="font-semibold text-sm">Asistente tNPS</p>
            <p className="text-[11px] text-white/70">Responde al instante · Sin IA</p>
          </div>

          <div className="h-72 overflow-y-auto scroll-fino p-3 space-y-2 bg-muted/30">
            {mensajes.map((m) => (
              <div key={m.id} className={cn('flex', m.esBot ? 'justify-start' : 'justify-end')}>
                <p
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                    m.esBot ? 'bg-card border' : 'bg-claro-red text-white'
                  )}
                >
                  {m.texto}
                </p>
              </div>
            ))}
            <div ref={finalRef} />
          </div>

          <div className="flex gap-2 p-2 border-t">
            <Input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="Escribe tu pregunta…"
              aria-label="Mensaje para el asistente"
              className="h-9"
            />
            <Button size="icon" onClick={enviar} aria-label="Enviar" className="h-9 w-9 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
