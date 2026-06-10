import pandas as pd
import folium
from folium.plugins import HeatMap, MiniMap, Fullscreen, Search
from folium import FeatureGroup, LayerControl
from branca.element import MacroElement
from jinja2 import Template

# =============================================================================
# 1. CONFIGURACIÓN Y CONSTANTES
# =============================================================================

ARCHIVO_EXCEL = 'mediciones.xlsx'
ARCHIVO_SALIDA = 'mapa_luminarias.html'

# Columnas esperadas del Excel (exportado por KoboToolbox)
COL_LAT = '_Coordenadas GPS_latitude'
COL_LON = '_Coordenadas GPS_longitude'
COL_ALT = '_Coordenadas GPS_altitude'
COL_PREC = '_Coordenadas GPS_precision'

# Mapeo semántico: Estado -> (color_marcador, descripcion_leyenda)
ESTADOS_CONFIG = {
    'enciende':         {'color': 'green',  'label': 'Funciona correctamente'},
    'no enciende':      {'color': 'red',    'label': 'No enciende'},
    'dañado/parpadea':  {'color': 'orange', 'label': 'Dañado o parpadea'},
}

# Mapeo: Tipo de luminaria -> (icono, prefijo_fontawesome, color_icono)
TIPOS_CONFIG = {
    'led':   {'icon': 'bolt',      'prefix': 'fa', 'label': 'LED'},
    'sodio': {'icon': 'lightbulb', 'prefix': 'fa', 'label': 'Sodio'},
}

# Gradientes personalizados para el mapa de calor (de bajo a alto luxes)
HEATMAP_GRADIENT = {
    0.0: '#313695',  # Azul oscuro
    0.2: '#4575b4',  # Azul
    0.4: '#74add1',  # Azul claro
    0.6: '#fdae61',  # Naranja
    0.8: '#f46d43',  # Rojo-naranja
    1.0: '#d73027',  # Rojo intenso
}


# =============================================================================
# 2. CLASE PARA LEYENDA PERSONALIZADA
# =============================================================================

class Legend(MacroElement):
    """Añade una leyenda HTML fija en el mapa."""
    def __init__(self, html_content, position='bottomright'):
        super().__init__()
        self._name = 'Legend'
        self.position = position
        self.html_content = html_content

    def render(self, **kwargs):
        super().render(**kwargs)
        script = Template("""
            {% macro script(this, kwargs) %}
            var legend = L.control({position: '{{ this.position }}'});
            legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'info legend');
                div.style.backgroundColor = 'white';
                div.style.padding = '10px';
                div.style.borderRadius = '5px';
                div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
                div.style.fontFamily = 'Arial, sans-serif';
                div.style.fontSize = '12px';
                div.style.lineHeight = '1.6';
                div.innerHTML = `{{ this.html_content }}`;
                return div;
            };
            legend.addTo({{ this._parent.get_name() }});
            {% endmacro %}
        """)
        self._template = Template("""
            {% macro header(this, kwargs) %}
            <style>
                .legend i {
                    width: 12px;
                    height: 12px;
                    float: left;
                    margin-right: 8px;
                    opacity: 0.9;
                    border-radius: 50%;
                }
            </style>
            {% endmacro %}
        """)
        self._template = script


# =============================================================================
# 3. FUNCIONES AUXILIARES
# =============================================================================

def safe_str(valor, default='No especificado'):
    """Convierte un valor a string de forma segura, manejando NaN y None."""
    if pd.isna(valor):
        return default
    return str(valor).strip() or default


def safe_float(valor, default=None):
    """Convierte un valor a float de forma segura."""
    try:
        if pd.isna(valor):
            return default
        return float(valor)
    except (ValueError, TypeError):
        return default


def obtener_config_estado(estado_str):
    """Retorna configuración de color según el estado del foco."""
    estado_limpio = safe_str(estado_str, 'desconocido').lower()
    return ESTADOS_CONFIG.get(estado_limpio, {'color': 'gray', 'label': 'Estado desconocido'})


def obtener_config_tipo(tipo_str):
    """Retorna configuración de icono según el tipo de luminaria."""
    tipo_limpio = safe_str(tipo_str, 'desconocido').lower()
    # Si no está en el mapeo, usamos valores por defecto
    return TIPOS_CONFIG.get(
        tipo_limpio, 
        {'icon': 'question-circle', 'prefix': 'fa', 'label': tipo_limpio.upper()}
    )


def generar_popup(id_registro, sector, tipo, altura, luxes, estado_foco, 
                  color_estado, lat, lon, alt, url_foto):
    """Genera el HTML del popup con diseño profesional."""
    
    # Formatear luxes para visualización
    lux_display = f"{luxes} lx" if isinstance(luxes, (int, float)) else str(luxes)
    
    # Estado con badge de color
    estado_html = f"""
        <span style="background-color: {color_estado}; color: white; 
                     padding: 2px 8px; border-radius: 10px; font-size: 11px; 
                     font-weight: bold; text-transform: uppercase;">
            {safe_str(estado_foco).upper()}
        </span>
    """
    
    return f"""
    <style>
        /* Sobrescribe el fondo blanco por defecto del popup del mapa */
        .leaflet-popup-content-wrapper {{
            background: rgba(15, 23, 42, 0.85) !important; /* Azul muy oscuro y 85% transparente */
            backdrop-filter: blur(4px) !important; /* Efecto cristal */
            color: #f8fafc !important;
            border-radius: 6px !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important;
        }}
        .leaflet-popup-tip {{
            background: rgba(15, 23, 42, 0.85) !important;
        }}
        .leaflet-popup-content {{
            margin: 0 !important;
        }}
    </style>

    <div style="font-family: 'Segoe UI', Arial, sans-serif; min-width: 280px; font-size: 15px; padding: 16px; color: #cbd5e1;">
        
        <h4 style="margin: 0 0 12px 0; font-size: 17px; color: #ffffff; font-weight: 600; border-bottom: 1px solid #334155; padding-bottom: 8px;">
            Luminaria #{id_registro}
            <div style="font-size: 13px; font-weight: 400; color: #94a3b8; margin-top: 4px;">
                {safe_str(sector).title()}
            </div>
        </h4>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
            <tr>
                <td style="color: #94a3b8; padding: 6px 0; width: 45%;">Tipo:</td>
                <td style="font-weight: 500; color: #ffffff; padding: 6px 0;">{safe_str(tipo).upper()}</td>
            </tr>
            <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Altura Poste:</td>
                <td style="font-weight: 500; color: #ffffff; padding: 6px 0;">{safe_str(altura)} m</td>
            </tr>
            <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Medición Luxes:</td>
                <td style="font-weight: 500; color: #ffffff; padding: 6px 0;">{lux_display}</td>
            </tr>
            <tr>
                <td style="color: #94a3b8; padding: 6px 0;">Estado:</td>
                <td style="font-weight: 500; color: #ffffff; padding: 6px 0;">{safe_str(estado_foco).title()}</td>
            </tr>
        </table>
        
        <div style="font-size: 15px; color: #64748b; border-top: 1px solid #334155; padding-top: 15px; margin-bottom: 16px; line-height: 1.6;">
            Lat: {lat:.6f}<br>
            Lon: {lon:.6f}<br>
            Alt: {safe_float(alt, 0):.1f} msnm
        </div>
        
        <a href="{safe_str(url_foto, '#')}" target="_blank" 
           style="display: block; text-align: center; border: 1px solid #475569; background: rgba(255,255,255,0.05);
                  color: #ffffff; text-decoration: none; padding: 8px; border-radius: 4px; 
                  font-weight: 500; font-size: 14px; transition: all 0.2s;">
            Ver Foto
        </a>
    </div>
    """


# =============================================================================
# 4. PROCESAMIENTO PRINCIPAL
# =============================================================================

def crear_mapa_luminarias():
    print("=" * 60)
    print("MAPEO DE LUMINARIAS - PROCESAMIENTO")
    print("=" * 60)
    
    # --- 4.1 CARGAR DATOS ---
    print("\n[1/6] Leyendo archivo Excel...")
    try:
        df = pd.read_excel(ARCHIVO_EXCEL)
        print(f"      ✓ {len(df)} registros encontrados")
    except FileNotFoundError:
        print(f"      ✗ ERROR: No se encontró '{ARCHIVO_EXCEL}'")
        return
    except Exception as e:
        print(f"      ✗ ERROR al leer Excel: {e}")
        return
    
    # --- 4.2 VALIDAR COLUMNAS REQUERIDAS ---
    print("[2/6] Validando estructura de columnas...")
    columnas_faltantes = []
    for col in [COL_LAT, COL_LON]:
        if col not in df.columns:
            columnas_faltantes.append(col)
    
    if columnas_faltantes:
        print(f"      ✗ Faltan columnas críticas: {columnas_faltantes}")
        print(f"      Columnas disponibles: {list(df.columns)}")
        return
    
    # Limpiar coordenadas inválidas
    df_inicial = len(df)
    df = df.dropna(subset=[COL_LAT, COL_LON])
    df = df[(df[COL_LAT].between(-90, 90)) & (df[COL_LON].between(-180, 180))]
    print(f"      ✓ {len(df)} registros con coordenadas válidas ({df_inicial - len(df)} descartados)")
    
    if df.empty:
        print("      ✗ No hay datos válidos para mapear")
        return
    
    # --- 4.3 CREAR MAPA BASE ---
    print("[3/6] Inicializando mapa interactivo...")
    centro_lat = df[COL_LAT].median()  # Mediana es más robusta que media ante outliers
    centro_lon = df[COL_LON].median()
    
    mapa = folium.Map(
        location=[centro_lat, centro_lon],
        zoom_start=17,
        tiles=None,  # Empezamos sin tiles para tener control total de capas
        control_scale=True  # Barra de escala métrica
    )
    
    # Múltiples capas base (el usuario puede cambiar entre ellas)
    folium.TileLayer('OpenStreetMap', name=' Calles', control=True).add_to(mapa)
    folium.TileLayer('CartoDB positron', name=' Claro', control=True).add_to(mapa)
    folium.TileLayer('CartoDB dark_matter', name=' Oscuro', control=True).add_to(mapa)
    folium.TileLayer(
        tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr='Esri',
        name='🛰️ Satelital',
        overlay=False,
        control=True,
        max_zoom=20,
        max_native_zoom=17   
    ).add_to(mapa)
    
    # --- 4.4 GRUPOS DE CAPAS ---
    fg_led = FeatureGroup(name=' Luminarias LED', show=True)
    fg_sodio = FeatureGroup(name=' Luminarias Sodio', show=True)
    fg_otros = FeatureGroup(name=' Otros tipos', show=True)
    fg_calor = FeatureGroup(name=' Mapa de Calor', show=False)  # Apagado por defecto
    
    datos_mapa_calor = []
    estadisticas = {
        'total': 0, 'led': 0, 'sodio': 0, 'otros': 0,
        'funcionan': 0, 'no_funcionan': 0, 'danados': 0, 'desconocido': 0,
        'con_medicion': 0, 'sin_medicion': 0
    }
    
    # --- 4.5 PROCESAR CADA REGISTRO ---
    print("[4/6] Procesando registros...")
    
    for _, fila in df.iterrows():
        lat = fila[COL_LAT]
        lon = fila[COL_LON]
        alt = fila.get(COL_ALT)
        
        # Extraer datos de forma segura
        sector = safe_str(fila.get('Facultad/Sector'), 'Campus UCE')
        tipo = safe_str(fila.get('Tipo de Luminaria '), 'Desconocido')
        altura = safe_str(fila.get('Altura del poste '), 'N/A')
        luxes_raw = fila.get('Medición de luxes ', None)
        estado_foco = safe_str(fila.get('Estado del foco'), 'Desconocido')
        id_registro = safe_str(fila.get('_id'), f'REG-{estadisticas["total"]+1}')
        url_foto = safe_str(fila.get('Foto del poste _URL'), '#')
        
        # --- Procesar luxes ---
        luxes = safe_float(luxes_raw, None)
        if luxes is not None and luxes > 0:
            datos_mapa_calor.append([lat, lon, luxes * 0.5])
            luxes_display = luxes
            estadisticas['con_medicion'] += 1
        else:
            luxes_display = "Sin medición"
            estadisticas['sin_medicion'] += 1
        
        # --- Configuración visual ---
        config_estado = obtener_config_estado(estado_foco)
        color_marcador = config_estado['color']
        
        config_tipo = obtener_config_tipo(tipo)
        icono_foco = config_tipo['icon']
        prefix_fa = config_tipo['prefix']
        label_tipo = config_tipo['label']
        
        # Determinar grupo
        tipo_lower = tipo.lower()
        if tipo_lower == 'led':
            target_cluster = fg_led
            estadisticas['led'] += 1
        elif tipo_lower == 'sodio':
            target_cluster = fg_sodio
            estadisticas['sodio'] += 1
        else:
            target_cluster = fg_otros
            estadisticas['otros'] += 1
        
        # Estadísticas de estado
        estado_key = safe_str(estado_foco, 'desconocido').lower()
        if estado_key == 'enciende':
            estadisticas['funcionan'] += 1
        elif estado_key == 'no enciende':
            estadisticas['no_funcionan'] += 1
        elif estado_key == 'dañado/parpadea':
            estadisticas['danados'] += 1
        else:
            estadisticas['desconocido'] += 1
        
        estadisticas['total'] += 1
        
        # --- Crear marcador ---
        popup_html = generar_popup(
            id_registro, sector, tipo, altura, luxes_display,
            estado_foco, color_marcador, lat, lon, alt, url_foto
        )
        
        tooltip_text = f"{label_tipo} | {safe_str(estado_foco).title()} | {sector}"
        
        marcador = folium.Marker(
            location=[lat, lon],
            popup=folium.Popup(popup_html, max_width=320),
            tooltip=folium.Tooltip(tooltip_text, sticky=True),
            icon=folium.Icon(
                color=color_marcador,
                icon=icono_foco,
                prefix=prefix_fa,
                icon_color='white' if color_marcador != 'gray' else 'black'
            )
        )
        marcador.add_to(target_cluster)
    
    print(f"      ✓ {estadisticas['total']} marcadores creados")
    print(f"        - LED: {estadisticas['led']} | Sodio: {estadisticas['sodio']} | Otros: {estadisticas['otros']}")
    print(f"        - Funcionan: {estadisticas['funcionan']} | No funcionan: {estadisticas['no_funcionan']} | Dañados: {estadisticas['danados']}")
    
    # --- 4.6 MAPA DE CALOR ---
    print("[5/6] Configurando capas adicionales...")
    if datos_mapa_calor:
        HeatMap(
            datos_mapa_calor,
            radius=30,
            blur=20,
            max_zoom=20,
            gradient=HEATMAP_GRADIENT,
            name="Mapa de Calor (Luxes)"
        ).add_to(fg_calor)
        print(f"      ✓ Mapa de calor: {len(datos_mapa_calor)} puntos con medición")
    
    # --- 4.7 AÑADIR ELEMENTOS AL MAPA ---
    
    # Grupos de luminarias
    fg_led.add_to(mapa)
    fg_sodio.add_to(mapa)
    fg_otros.add_to(mapa)
    fg_calor.add_to(mapa)
    
    # Control de capas (para encender/apagar)
    LayerControl(collapsed=False, position='topright').add_to(mapa)
    
    # Mini mapa de referencia
    MiniMap(toggle_display=True, position='bottomleft').add_to(mapa)
    
    # Botón de pantalla completa
    Fullscreen(position='topleft').add_to(mapa)
    
    # Barra de escala (ya añadida en el Map constructor con control_scale)
    
    # LEYENDA personalizada
    leyenda_html = """
        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px;">🗺️ Leyenda</h4>
        <b style="color: #475569; font-size: 11px;">ESTADO DEL FOCO</b><br>
        <i style="background: #2ecc71;"></i> Funciona correctamente<br>
        <i style="background: #e74c3c;"></i> No enciende<br>
        <i style="background: #f39c12;"></i> Dañado/parpadea<br>
        <i style="background: #95a5a6;"></i> Estado desconocido<br>
        <br>
        <b style="color: #475569; font-size: 11px;">TIPO DE LUMINARIA</b><br>
        ⚡ LED (rayo) | 💡 Sodio (foco)<br>
        <br>
        <b style="color: #475569; font-size: 11px;">MAPA DE CALOR</b><br>
        <div style="background: linear-gradient(to right, #313695, #74add1, #fdae61, #d73027); 
                    height: 12px; border-radius: 2px; margin-top: 4px;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
            <span>Bajo</span><span>Alto (luxes)</span>
        </div>
    """
    Legend(leyenda_html, position='bottomright').add_to(mapa)
    
    
    # --- 4.8 GUARDAR ---
    print("[6/6] Generando archivo HTML...")
    mapa.save(ARCHIVO_SALIDA)
    print(f"      ✓ Mapa guardado como: {ARCHIVO_SALIDA}")
    
    # --- RESUMEN FINAL ---
    print("\n" + "=" * 60)
    print("RESUMEN DE PROCESAMIENTO")
    print("=" * 60)
    print(f" Total luminarias mapeadas: {estadisticas['total']}")
    print(f"   LED:      {estadisticas['led']:4d} ({estadisticas['led']/max(estadisticas['total'],1)*100:.1f}%)")
    print(f"   Sodio:    {estadisticas['sodio']:4d} ({estadisticas['sodio']/max(estadisticas['total'],1)*100:.1f}%)")
    print(f"   Otros:    {estadisticas['otros']:4d}")
    print(f"\n Estado:")
    print(f"   Funcionan:   {estadisticas['funcionan']:4d}")
    print(f"   No encienden:{estadisticas['no_funcionan']:4d}")
    print(f"   Dañados:     {estadisticas['danados']:4d}")
    print(f"   Desconocido: {estadisticas['desconocido']:4d}")
    print(f"\n Mediciones:")
    print(f"   Con medición: {estadisticas['con_medicion']}")
    print(f"   Sin medición: {estadisticas['sin_medicion']}")
    print(f"\n Abre '{ARCHIVO_SALIDA}' en tu navegador")
    print("=" * 60)


# =============================================================================
# EJECUCIÓN
# =============================================================================
if __name__ == '__main__':
    crear_mapa_luminarias()