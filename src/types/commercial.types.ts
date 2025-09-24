export interface Commercial {
  year:       number;           // Año de emisión del comercial
  duration:   string;          // Duración del archivo de video (formato: "mm:ss" o "hh:mm:ss")
  fileName:   string;          // Ruta del archivo de video del comercial
}

export interface CommercialContext {
  id:          string;         // ID único del contexto de comerciales
  name:        string;         // Nombre del contexto (producto, compañía, canal, etc.)
  description?: string;        // Descripción opcional del contexto
  channel:     string[];       // Canales asociados (puede ser múltiples canales)
  commercials: Commercial[];   // Arreglo de comerciales del contexto
}

export interface CommercialConfig {
  contexts:    CommercialContext[];  // Lista de contextos de comerciales
  lastUpdated: string;              // Fecha de última actualización
}