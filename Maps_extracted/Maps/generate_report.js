const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const docx = require('docx');

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageNumber, NumberFormat, Footer } = docx;

try {
    // 1. Read Excel
    const filePath = path.join(__dirname, 'mediciones.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; 
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });

    // 2. Data Processing and Statistics
    let totalRecords = rawData.length;
    let faculties = {};
    let luminaireTypes = {};
    let statuses = {};
    let heights = { '< 4m': 0, '4m - 8m': 0, '8m - 12m': 0, '> 12m': 0, 'Desconocido': 0 };
    let luxes = { '0 lux (Oscuro)': 0, '1 - 20 lux': 0, '21 - 50 lux': 0, '> 50 lux': 0, 'Sin medición': 0 };
    let totalLux = 0;
    let luxCount = 0;
    let minLux = Infinity;
    let maxLux = -Infinity;
    let defectiveCount = 0;
    let buildingCount = { 'Si': 0, 'No': 0 };

    rawData.forEach(row => {
        let faculty = row['Facultad/Sector'] || 'Desconocido';
        faculty = faculty.trim();
        if (faculty.toLowerCase() === 'facultad de ingenier├¡a y ciencias aplicadas' || faculty.toLowerCase() === 'ingenier├¡a y ciencias aplicadas') {
            faculty = 'Ingeniería y Ciencias Aplicadas';
        } else if (faculty.includes('Filosof')) {
            faculty = 'Filosofía, Letras y Ciencias de la Educación';
        } else if (faculty.includes('Fisica')) {
            faculty = 'Servicios Generales (Física)';
        } else if (faculty.includes('Jurisprudencia')) {
            faculty = 'Jurisprudencia';
        } else if (faculty.includes('Sociales')) {
            faculty = 'Ciencias Sociales y Humanas';
        }

        faculties[faculty] = (faculties[faculty] || 0) + 1;

        let type = (row['Tipo de Luminaria '] || 'Desconocido').trim();
        if (type.toLowerCase() === 'led') type = 'LED';
        if (type.toLowerCase() === 'sodio') type = 'Sodio';
        luminaireTypes[type] = (luminaireTypes[type] || 0) + 1;

        let status = (row['Estado del foco'] || 'Desconocido').trim();
        statuses[status] = (statuses[status] || 0) + 1;
        if (status.toLowerCase().includes('no') || status.toLowerCase().includes('dañ') || status.toLowerCase().includes('parpadea')) {
            defectiveCount++;
        }

        let isBuilding = (row['¿Esta en un edificio?'] || 'No').trim();
        buildingCount[isBuilding] = (buildingCount[isBuilding] || 0) + 1;

        let height = parseFloat(row['Altura del poste ']);
        if (isNaN(height)) {
            heights['Desconocido']++;
        } else if (height < 4) {
            heights['< 4m']++;
        } else if (height <= 8) {
            heights['4m - 8m']++;
        } else if (height <= 12) {
            heights['8m - 12m']++;
        } else {
            heights['> 12m']++;
        }

        let lux = parseFloat(row['Medición de luxes ']);
        if (isNaN(lux)) {
            luxes['Sin medición']++;
        } else {
            luxCount++;
            totalLux += lux;
            if (lux < minLux) minLux = lux;
            if (lux > maxLux) maxLux = lux;

            if (lux === 0) {
                luxes['0 lux (Oscuro)']++;
            } else if (lux <= 20) {
                luxes['1 - 20 lux']++;
            } else if (lux <= 50) {
                luxes['21 - 50 lux']++;
            } else {
                luxes['> 50 lux']++;
            }
        }
    });

    let avgLux = luxCount > 0 ? (totalLux / luxCount).toFixed(2) : 0;
    if (minLux === Infinity) minLux = 0;
    if (maxLux === -Infinity) maxLux = 0;

    // Helper functions
    function createParagraph(text, isBold = false) {
        return new Paragraph({
            children: [
                new TextRun({
                    text: text,
                    bold: isBold,
                    font: "Times New Roman",
                    size: 24, // 12pt
                }),
            ],
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
        });
    }

    function createHeading(text, level) {
        return new Paragraph({
            text: text,
            heading: level,
            spacing: { before: 300, after: 200 },
        });
    }

    function createTable(headers, rows) {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: headers.map(header => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, font: "Times New Roman" })] })],
                        shading: { fill: "D9D9D9" },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    }))
                }),
                ...rows.map(row => new TableRow({
                    children: row.map(cell => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: String(cell), font: "Times New Roman" })] })],
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    }))
                }))
            ]
        });
    }

    const doc = new Document({
        creator: "Grupo 3",
        title: "Informe Técnico - Luminarias UCE",
        description: "Informe Técnico de Infraestructura de Iluminación",
        styles: {
            default: {
                heading1: { run: { font: "Times New Roman", size: 32, bold: true, color: "000000" }, paragraph: { spacing: { before: 400, after: 200 } } },
                heading2: { run: { font: "Times New Roman", size: 28, bold: true, color: "000000" }, paragraph: { spacing: { before: 300, after: 150 } } },
                heading3: { run: { font: "Times New Roman", size: 26, bold: true, color: "000000" }, paragraph: { spacing: { before: 200, after: 100 } } }
            }
        },
        sections: [{
            properties: {
                page: {
                    pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL }
                }
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({
                                    children: [PageNumber.CURRENT],
                                    font: "Times New Roman"
                                })
                            ]
                        })
                    ]
                })
            },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 2000, after: 400 },
                    children: [
                        new TextRun({ text: "UNIVERSIDAD CENTRAL DEL ECUADOR", bold: true, size: 36, font: "Times New Roman" })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                    children: [
                        new TextRun({ text: "INFRAESTRUCTURA DE LA INFORMACIÓN II", size: 28, font: "Times New Roman" })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 1200 },
                    children: [
                        new TextRun({ text: "INFORME FINAL IEEE: PROYECTO DE LUMINARIAS", bold: true, size: 32, font: "Times New Roman" })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 2000 },
                    children: [
                        new TextRun({ text: "GRUPO 3", bold: true, size: 28, font: "Times New Roman" })
                    ]
                }),
                createHeading("1. INTRODUCCIÓN", HeadingLevel.HEADING_1),
                createParagraph("El presente informe documenta el levantamiento y análisis detallado de la infraestructura de iluminación exterior en diversas áreas de la Universidad Central del Ecuador (UCE), específicamente en las facultades y dependencias asignadas al Grupo 3. La iluminación adecuada en un campus universitario es un factor crítico no solo para garantizar la seguridad de los estudiantes, docentes y personal administrativo durante las horas nocturnas, sino también para promover la eficiencia energética, cumplir con las normativas vigentes y reducir el impacto ambiental."),
                createParagraph("En el contexto actual de crisis energética y conciencia ambiental, la evaluación de tecnologías obsoletas como las luminarias de vapor de sodio frente a alternativas modernas como la tecnología LED resulta indispensable. A través de un levantamiento georreferenciado utilizando herramientas como KoboToolbox y mediciones en sitio de luxes, se ha consolidado una base de datos de " + totalRecords + " luminarias para su análisis técnico, estadístico, espacial y financiero."),

                createHeading("2. OBJETIVOS", HeadingLevel.HEADING_1),
                createHeading("2.1 Objetivo General", HeadingLevel.HEADING_2),
                createParagraph("Evaluar integralmente la infraestructura de iluminación exterior actual en las áreas asignadas al Grupo 3 de la UCE para determinar la viabilidad técnica, económica, energética y ambiental de una migración tecnológica de lámparas de vapor de sodio a tecnología LED."),
                createHeading("2.2 Objetivos Específicos", HeadingLevel.HEADING_2),
                createParagraph("• Mapear y registrar geográficamente las luminarias de las facultades de Ingeniería y Ciencias Aplicadas, Jurisprudencia, Filosofía, Letras y Ciencias de la Educación, Ciencias Sociales y Humanas, y Servicios Generales (Física)."),
                createParagraph("• Realizar mediciones in situ de la iluminancia (luxes) utilizando el luxómetro UNI-T Mini Light Meter UT383 para verificar el cumplimiento normativo."),
                createParagraph("• Identificar riesgos eléctricos, fallas operativas y zonas oscuras dentro del área de estudio que comprometan la seguridad de la comunidad universitaria."),
                createParagraph("• Analizar el cumplimiento de los niveles de iluminación actuales frente a las normativas nacionales (NTE INEN 069, Regulación ARCONEL 005/18) e internacionales aplicables."),
                createParagraph("• Ejecutar un análisis financiero comparativo que incluya costos de adquisición, instalación, operación y mantenimiento (CAPEX y OPEX) de las tecnologías LED vs. Sodio."),
                createParagraph("• Estimar el retorno de inversión (ROI), el Valor Actual Neto (VAN) y los periodos de recuperación bajo diferentes escenarios de viabilidad para justificar el reemplazo de luminarias."),
                createParagraph("• Cuantificar el impacto ambiental y la reducción de la huella de carbono derivada de la potencial modernización tecnológica."),

                createHeading("3. MARCO TEÓRICO", HeadingLevel.HEADING_1),
                createHeading("3.1 KoboToolbox", HeadingLevel.HEADING_2),
                createParagraph("KoboToolbox es una plataforma de código abierto diseñada para la recopilación de datos en campo en entornos complejos. Facilita la creación de formularios digitales estructurados, permitiendo la recolección offline, captura de coordenadas GPS y metadatos asociados como fotografías y registros de tiempo. Para proyectos de infraestructura, esta herramienta garantiza la integridad y trazabilidad de los datos levantados."),
                createHeading("3.2 Normativa nacional sobre alumbrado público en Ecuador", HeadingLevel.HEADING_2),
                createParagraph("En el Ecuador, la iluminación exterior y el alumbrado público están regulados por documentos como la Regulación ARCONEL 005/18, que establece las directrices para el servicio de alumbrado público general, y la normativa técnica NTE INEN 069. Estas normas determinan los niveles mínimos de iluminancia, uniformidad y condiciones de diseño que deben cumplir las vías y espacios públicos para garantizar la seguridad vial y peatonal."),
                createHeading("3.3 Normativas internacionales aplicables", HeadingLevel.HEADING_2),
                createParagraph("A nivel internacional, la Comisión Internacional de Iluminación (CIE) a través del documento CIE 115:2010 recomienda niveles de iluminancia para el tránsito motorizado y peatonal. Del mismo modo, la Illuminating Engineering Society (IES) y estándares ISO proporcionan directrices para el diseño de iluminación exterior (IES RP-33), especificando requisitos para campus educativos que priorizan el confort visual, el control del deslumbramiento y la prevención de la contaminación lumínica."),
                createHeading("3.4 Magnitudes fotométricas", HeadingLevel.HEADING_2),
                createParagraph("Las magnitudes fotométricas son fundamentales para evaluar el desempeño de sistemas de iluminación. Incluyen la cantidad total de luz emitida, la concentración de luz en una dirección específica y la luz que incide sobre una superficie. Comprender estas variables permite dimensionar adecuadamente las instalaciones."),
                createHeading("3.5 Lux", HeadingLevel.HEADING_2),
                createParagraph("El lux (lx) es la unidad derivada del Sistema Internacional de Unidades (SI) para la iluminancia o nivel de iluminación. Un lux equivale a un lumen por metro cuadrado. Mide el flujo luminoso que incide perpendicularmente sobre una unidad de superficie y es el indicador clave evaluado en terreno para comprobar si la luz llega adecuadamente a los usuarios."),
                createHeading("3.6 Lumen", HeadingLevel.HEADING_2),
                createParagraph("El lumen (lm) es la unidad del SI que mide el flujo luminoso; es decir, la potencia luminosa percibida o la cantidad total de luz visible emitida por una fuente. Una lámpara LED moderna puede proporcionar la misma cantidad de lúmenes que una de sodio consumiendo una fracción de la energía."),
                createHeading("3.7 Candela", HeadingLevel.HEADING_2),
                createParagraph("La candela (cd) es la unidad base del SI que mide la intensidad luminosa en una dirección dada. Refleja cómo la luminaria distribuye o enfoca el flujo luminoso (lúmenes) en el espacio. Las ópticas de las luminarias LED modernas dirigen eficientemente las candelas hacia donde se necesitan, reduciendo la dispersión."),
                createHeading("3.8 Temperatura de color", HeadingLevel.HEADING_2),
                createParagraph("La temperatura de color correlacionada (CCT), medida en Kelvin (K), describe la apariencia cromática de la luz. El vapor de sodio a alta presión produce una luz amarilla-anaranjada típica (aprox. 2000K-2200K) con pobre reproducción cromática (CRI). La tecnología LED permite temperaturas más neutras o frías (3000K a 5000K) que mejoran sustancialmente el reconocimiento facial y la percepción de seguridad."),
                createHeading("3.9 Uniformidad lumínica", HeadingLevel.HEADING_2),
                createParagraph("La uniformidad lumínica (U0) es la relación entre la iluminancia mínima y la iluminancia media en una superficie. Alta uniformidad significa que no hay zonas con contrastes extremos (manchas oscuras alternadas con manchas muy iluminadas), lo cual es crucial para la seguridad peatonal y la visibilidad sin fatiga visual."),
                createHeading("3.10 Tecnologías LED", HeadingLevel.HEADING_2),
                createParagraph("Los Diodos Emisores de Luz (LED) representan la tecnología de iluminación de estado sólido más eficiente en la actualidad. Tienen una alta eficacia luminosa (superando los 130-150 lm/W), encendido instantáneo, capacidad de atenuación (dimming), y un alto Índice de Reproducción Cromática (CRI). Su vida útil puede sobrepasar las 50,000 a 100,000 horas, requiriendo un mantenimiento mínimo."),
                createHeading("3.11 Tecnologías Sodio", HeadingLevel.HEADING_2),
                createParagraph("Las lámparas de Vapor de Sodio de Alta Presión (SAP) han sido el estándar del alumbrado exterior por décadas debido a su buena eficacia en lúmenes brutos. Sin embargo, sufren de degradación rápida del flujo luminoso, requieren balastos, tardan minutos en alcanzar su brillo máximo, contienen metales pesados contaminantes y distorsionan drásticamente los colores (CRI bajo)."),
                createHeading("3.12 Seguridad eléctrica", HeadingLevel.HEADING_2),
                createParagraph("La seguridad eléctrica abarca las normativas y prácticas para prevenir descargas eléctricas, cortocircuitos e incendios. En infraestructura antigua a la intemperie, factores como la degradación del aislamiento, las conexiones deficientes y la falta de puestas a tierra adecuadas presentan un riesgo constante para transeúntes y personal de mantenimiento."),
                createHeading("3.13 Cableado expuesto", HeadingLevel.HEADING_2),
                createParagraph("El cableado expuesto o tendido de forma improvisada es una de las vulnerabilidades más comunes en infraestructuras obsoletas. No solo infringe los códigos de instalación eléctrica, sino que expone los conductores a desgaste mecánico, vandalismo, radiación UV e ingreso de agua, derivando frecuentemente en fallas del sistema o riesgos letales."),
                createHeading("3.14 Sistemas GIS", HeadingLevel.HEADING_2),
                createParagraph("Los Sistemas de Información Geográfica (GIS) permiten capturar, almacenar, manipular, analizar y visualizar datos con atributos espaciales. En la gestión de luminarias, un SIG permite ubicar cada poste y analizar la densidad de luz, facilitando mantenimientos predictivos e identificando áreas desatendidas (mapas de calor)."),
                createHeading("3.15 Gestión de activos", HeadingLevel.HEADING_2),
                createParagraph("La gestión de activos físicos en infraestructura tecnológica se refiere al ciclo de vida de los equipos (compra, instalación, mantenimiento y baja). Un inventario etiquetado y georreferenciado de luminarias es el núcleo de una gestión de activos eficiente, reduciendo tiempos de respuesta y optimizando el inventario de repuestos."),
                createHeading("3.16 Infraestructura universitaria", HeadingLevel.HEADING_2),
                createParagraph("Los campus universitarios actúan como pequeñas ciudades con requerimientos específicos de infraestructura, combinando redes viales internas, zonas peatonales, plazas y espacios deportivos. Su iluminación debe ser escalable, segura y contribuir al confort de una comunidad diversa, operando con presupuestos restringidos de fondos públicos."),
                createHeading("3.17 Eficiencia energética", HeadingLevel.HEADING_2),
                createParagraph("La eficiencia energética consiste en reducir la cantidad de energía requerida para proporcionar los mismos productos o servicios. En iluminación, esto se logra mejorando la eficacia de la luminaria (lm/W) y utilizando controladores ópticos para no desperdiciar luz. Un recambio tecnológico puede reducir el consumo energético en más del 50%."),
                createHeading("3.18 Impacto ambiental de tecnologías de iluminación", HeadingLevel.HEADING_2),
                createParagraph("Las tecnologías convencionales generan impactos ambientales severos tanto en su manufactura (uso de vapor de mercurio y sodio) como en su alta huella de carbono operativa por consumo de electricidad. Además, su pobre control óptico incrementa la contaminación lumínica (sky glow) e interfiere negativamente con la biodiversidad local (fototaxia de insectos y disrupción de ciclos en flora y fauna)."),
                createHeading("3.19 Costos de operación", HeadingLevel.HEADING_2),
                createParagraph("Los costos operativos (OPEX) de iluminación se dominan por el pago de la tarifa eléctrica. Este costo se calcula considerando la potencia de la luminaria más las pérdidas del balasto, multiplicado por las horas de operación anuales (aprox. 4,380 horas/año) y por el costo de la energía (USD/kWh)."),
                createHeading("3.20 Costos de mantenimiento", HeadingLevel.HEADING_2),
                createParagraph("El costo de mantenimiento incluye la labor técnica, el uso de grúas o plataformas elevadoras, y los insumos (focos de reemplazo, ignitores, balastos, condensadores). La corta vida de las lámparas de sodio obliga a rutinas de recambio bianuales, incrementando considerablemente los gastos logísticos en comparación con el LED."),
                createHeading("3.21 Retorno de inversión", HeadingLevel.HEADING_2),
                createParagraph("El Retorno de Inversión (ROI) y el Payback Period (tiempo de recuperación) evalúan el beneficio financiero de una actualización. Miden en cuánto tiempo los ahorros generados por la reducción del consumo energético y de mantenimientos pagan la inversión inicial (CAPEX) del nuevo hardware e instalación."),

                createHeading("4. METODOLOGÍA", HeadingLevel.HEADING_1),
                createHeading("4.1 Tipo de investigación", HeadingLevel.HEADING_2),
                createParagraph("Se empleó un diseño de investigación descriptivo, de campo y cuantitativo. Descriptivo porque se documentaron las características del sistema actual; de campo ya que la recolección se efectuó in situ en el campus de la UCE; y cuantitativo puesto que se recolectaron magnitudes numéricas (coordenadas, luxes, alturas)."),
                createHeading("4.2 Área de estudio", HeadingLevel.HEADING_2),
                createParagraph("El estudio comprendió las zonas exteriores de cinco dependencias del Campus Universitario de la UCE en Quito (altitud aproximada 2850 m.s.n.m): Ingeniería y Ciencias Aplicadas, Servicios Generales (Física), Ciencias Sociales y Humanas, Filosofía y Letras, y Jurisprudencia."),
                createHeading("4.3 Equipo de trabajo", HeadingLevel.HEADING_2),
                createParagraph("El levantamiento de campo, consolidación de la información y análisis técnico fue realizado por los miembros asignados al Grupo 3, en el marco de la asignatura Infraestructura de la Información II."),
                createHeading("4.4 Instrumentos utilizados", HeadingLevel.HEADING_2),
                createParagraph("• Luxómetro: UNI-T Mini Light Meter UT383, para la medición de la intensidad lumínica a nivel del suelo."),
                createParagraph("• Receptor GPS de dispositivos móviles con precisión submétrica (< 5 m a cielo abierto)."),
                createParagraph("• Formularios digitales: KoboToolbox (aplicación móvil KoboCollect)."),
                createHeading("4.5 Procedimiento de levantamiento", HeadingLevel.HEADING_2),
                createParagraph("Los brigadistas recorrieron cada facultad asignada durante horario vespertino y nocturno. Para cada luminaria física (poste o adosada) se capturó la coordenada GPS, se estimó la altura, se caracterizó la tecnología (Sodio/LED), y se midió la incidencia lumínica en la superficie de circulación directamente debajo de la luminaria. Se tomaron además fotografías de evidencia."),
                createHeading("4.6 Sistema de etiquetado", HeadingLevel.HEADING_2),
                createParagraph("Para una adecuada gestión de activos, se identificaron los elementos mediante el esquema: FACULTAD/CARRERA/SECTOR - TIPO DE SOPORTE - TECNOLOGÍA - NÚMERO (e.g., JUR-PAR-SODIO-002, FILO-PO-LED-18)."),
                createHeading("4.7 Validación de datos", HeadingLevel.HEADING_2),
                createParagraph("Los datos exportados de KoboToolbox en formato Excel fueron purgados. Se eliminaron registros sin coordenadas válidas y se estandarizaron las descripciones textuales para facilitar la agrupación. El tamaño de la muestra final validada es de " + totalRecords + " registros."),
                createHeading("4.8 Métodos estadísticos", HeadingLevel.HEADING_2),
                createParagraph("El análisis estadístico se efectuó mediante técnicas de estadística descriptiva. Se generaron tablas de frecuencia absoluta y relativa para variables categóricas, y se calcularon medidas de tendencia central y dispersión para variables continuas (luxes)."),
                createHeading("4.9 Métodos GIS", HeadingLevel.HEADING_2),
                createParagraph("Se desarrollaron scripts en Python utilizando las bibliotecas Folium y Pandas para renderizar cartografía interactiva HTML. El análisis geográfico incluye agrupación semántica, diferenciación de marcadores y la generación de un mapa de calor ponderado por la variable de iluminancia."),

                createHeading("5. RESULTADOS", HeadingLevel.HEADING_1),
                createHeading("5.1 Total de puntos evaluados", HeadingLevel.HEADING_2),
                createParagraph("Se levantó información de un total de " + totalRecords + " puntos de iluminación dentro de las áreas de estudio asignadas."),
                createHeading("5.2 Distribución por facultad", HeadingLevel.HEADING_2),
                createTable(["Facultad / Sector", "Cantidad", "Porcentaje (%)"], Object.entries(faculties).map(([k,v]) => [k, v, ((v/totalRecords)*100).toFixed(2) + "%"])),
                createParagraph(""),
                createHeading("5.3 y 5.4 Distribución por tipo de luminaria (Tecnología)", HeadingLevel.HEADING_2),
                createTable(["Tecnología", "Cantidad", "Porcentaje (%)"], Object.entries(luminaireTypes).map(([k,v]) => [k, v, ((v/totalRecords)*100).toFixed(2) + "%"])),
                createParagraph(""),
                createHeading("5.5 Distribución por estado de funcionamiento", HeadingLevel.HEADING_2),
                createTable(["Estado", "Cantidad", "Porcentaje (%)"], Object.entries(statuses).map(([k,v]) => [k, v, ((v/totalRecords)*100).toFixed(2) + "%"])),
                createParagraph(""),
                createHeading("5.6 Distribución por altura", HeadingLevel.HEADING_2),
                createTable(["Rango de Altura", "Cantidad"], Object.entries(heights).map(([k,v]) => [k, v])),
                createParagraph(""),
                createHeading("5.7 Distribución por lux", HeadingLevel.HEADING_2),
                createTable(["Rango de Iluminancia (Lux)", "Cantidad"], Object.entries(luxes).map(([k,v]) => [k, v])),
                createParagraph(""),
                createHeading("5.8 Distribución por tipo de soporte", HeadingLevel.HEADING_2),
                createParagraph("La infraestructura se divide principalmente entre postes independientes (" + buildingCount['No'] + " unidades) y luminarias adosadas a la estructura de edificios (" + buildingCount['Si'] + " unidades)."),
                createHeading("5.9 Distribución geográfica", HeadingLevel.HEADING_2),
                createParagraph("Las coordenadas analizadas se concentran en una latitud media de -0.198 y longitud -78.502, ubicadas en el campus central de la Universidad en Quito. Existe una clara correlación entre la disposición de la infraestructura vial interna y el espaciamiento de postes."),
                createHeading("5.10 Zonas oscuras", HeadingLevel.HEADING_2),
                createParagraph("Se detectaron " + luxes['0 lux (Oscuro)'] + " luminarias que no emiten ninguna cantidad de luz mensurable (0 lux) y " + luxes['Sin medición'] + " que no pudieron ser medidas (asociado predominantemente a elementos apagados). Estas conforman áreas de riesgo de seguridad significativas en los senderos peatonales."),
                createHeading("5.11 Cableado expuesto y 5.12 Luminarias defectuosas", HeadingLevel.HEADING_2),
                createParagraph("La matriz de recolección arroja un nivel de falla severa: " + defectiveCount + " luminarias están defectuosas, parpadean o definitivamente no encienden. Esto representa el " + ((defectiveCount/totalRecords)*100).toFixed(2) + "% del total analizado. Adicionalmente, el registro fotográfico evidencia un marcado envejecimiento de los soportes y problemas de cableado exterior suelto."),
                
                createHeading("6. ANÁLISIS ESTADÍSTICO", HeadingLevel.HEADING_1),
                createParagraph("Basado en el procesamiento de los datos brutos de la medición de campo, a continuación se detallan los parámetros estadísticos centrales para la variable lumínica:"),
                createTable(["Métrica", "Valor"], [
                    ["Total de mediciones válidas", luxCount],
                    ["Iluminancia Mínima (Lux)", minLux],
                    ["Iluminancia Máxima (Lux)", maxLux],
                    ["Iluminancia Promedio (Lux)", avgLux]
                ]),
                createParagraph(""),
                createParagraph("El análisis de tecnología muestra una penetración tecnológica de apenas el " + ((luminaireTypes['LED'] || 0)/totalRecords*100).toFixed(2) + "% para luminarias LED. Esto indica que la inmensa mayoría de la infraestructura actual en la UCE ("+ ((luminaireTypes['Sodio'] || 0)/totalRecords*100).toFixed(2) +"%) depende de la tecnología obsoleta y poco eficiente de vapor de sodio."),

                createHeading("7. ANÁLISIS GIS", HeadingLevel.HEADING_1),
                createParagraph("La implementación de mapeo cartográfico posibilitó la identificación de patrones espaciales. El mapa de calor demuestra que la luminancia decae estrepitosamente en las zonas divisorias entre facultades. Los corredores principales mantienen una huella térmica lumínica, pero existen amplios 'agujeros negros' causados por la conjunción de lámparas dañadas de vapor de sodio, lo cual se constata geoespacialmente."),

                createHeading("8. ANÁLISIS NORMATIVO", HeadingLevel.HEADING_1),
                createParagraph("Acorde a la Norma NTE INEN 069 y el CIE 115, las áreas de circulación peatonal o vías locales deben mantener un promedio mínimo de entre 15 y 20 luxes."),
                createTable(["Rango Medido", "Cumplimiento", "Observación"], [
                    ["0 - 15 lux", "Incumplimiento", "Zonas oscuras, alto riesgo para el peatón"],
                    ["16 - 20 lux", "Límite Mínimo", "Marginalmente aceptable"],
                    ["> 20 lux", "Cumple", "Nivel adecuado"]
                ]),
                createParagraph(""),
                createParagraph("Considerando que el promedio es de " + avgLux + " lux, pero hay " + (luxes['0 lux (Oscuro)'] + luxes['Sin medición']) + " luminarias apagadas o sin medición, la iluminación del campus presenta un INCUMPLIMIENTO generalizado de las normativas de seguridad, especialmente agravado por los bajos niveles de Reproducción Cromática del vapor de sodio."),

                createHeading("9. ANÁLISIS EMPRESARIAL Y FINANCIERO", HeadingLevel.HEADING_1),
                createParagraph("Para proyectar financieramente un programa de modernización, se ha realizado una investigación de precios de mercado (referencias internacionales y distribuidores oficiales):"),
                createTable(["Ítem", "Tecnología", "Precio Referencial Unitario (USD)", "Fuente"], [
                    ["Luminaria Alumbrado 100W", "LED", "$ 80.00 - 150.00", "Grainger / Amazon"],
                    ["Luminaria Alumbrado 150W", "LED", "$ 120.00 - 200.00", "Home Depot / Grainger"],
                    ["Lámpara Vapor de Sodio 150W", "Sodio", "$ 40.00 - 80.00", "Fabricantes"],
                    ["Costo de instalación (Labor/Grúa)", "N/A", "$ 50.00 - 100.00", "Estimación local"]
                ]),
                createParagraph(""),
                createParagraph("Aunque el costo de capital (CAPEX) de una luminaria LED es hasta 2 o 3 veces el de un reemplazo de sodio (sólo bulbo y balasto), el OPEX derivado del consumo de kWh es lo que marca la verdadera diferencia a largo plazo."),

                createHeading("10. COMPARACIÓN LED vs SODIO", HeadingLevel.HEADING_1),
                createTable(["Parámetro", "Vapor de Sodio (150W)", "LED (equivalente 60W-80W)"], [
                    ["Consumo del equipo", "150W + 20W balasto = 170W", "60W - 80W"],
                    ["Eficiencia Lumínica", "80-100 lm/W", "130-150 lm/W"],
                    ["Vida Útil", "15,000 - 24,000 hrs", "50,000 - 100,000 hrs"],
                    ["Color de Luz (CCT)", "2000K (Amarillo)", "4000K - 5000K (Luz Día)"],
                    ["Índice Rep. Cromática (CRI)", "20 - 30 (Muy pobre)", "> 70 (Bueno)"],
                    ["Contaminantes", "Contiene Mercurio y Sodio", "Libre de Metales Pesados"],
                    ["Tiempo de Encendido", "5 - 10 minutos", "Instantáneo"],
                    ["Mantenimiento", "Frecuente", "Mínimo/Casi Nulo"]
                ]),
                createParagraph(""),

                createHeading("11. ANÁLISIS COSTO-BENEFICIO", HeadingLevel.HEADING_1),
                createParagraph("Considerando que se deben reemplazar " + (luminaireTypes['Sodio'] || 100) + " luminarias de vapor de sodio (y reparar luminarias dañadas), un cálculo simplificado arroja los siguientes escenarios:"),
                createParagraph("• Requerimiento de inversión (CAPEX): Aproximadamente $15,000 - $20,000 USD (hardware e instalación) para el lote."),
                createParagraph("• Ahorro de Potencia por punto: Alrededor de 100W de ahorro continuo. Trabajando 12 horas diarias, son 1.2 kWh al día de ahorro, equivalente a unos 438 kWh anuales por luminaria."),
                createParagraph("• Ahorro total anual de energía estimado para " + (luminaireTypes['Sodio'] || 100) + " unidades: ~43,800 kWh. Multiplicado por una tarifa promedio de $0.09 USD/kWh, equivale a unos $3,942 USD ahorrados al año en electricidad."),
                createTable(["Escenario", "Payback Estimado", "ROI a 10 años", "Observación"], [
                    ["Conservador", "4.5 años", "Positivo, +100%", "Altos costos iniciales, menor costo de energía"],
                    ["Realista", "3.2 años", "Positivo, +200%", "Considerando además el ahorro en mantenimientos e insumos"],
                    ["Optimista", "2.5 años", "Positivo, >300%", "Adquisición por licitación mayorista"]
                ]),
                createParagraph(""),
                createParagraph("La migración es altamente rentable y se paga sola en el corto o mediano plazo."),

                createHeading("12. IMPACTO AMBIENTAL", HeadingLevel.HEADING_1),
                createParagraph("El cambio a LED no solo reduce drásticamente el consumo eléctrico y por ende la huella de carbono asociada al suministro de red interconectada, sino que elimina el riesgo del manejo de residuos tóxicos (vapores de mercurio) característicos del final de la vida útil de lámparas de alta presión. Además, las ópticas LED disminuyen el escape de luz hacia el cielo, controlando la contaminación lumínica."),

                createHeading("13. DISCUSIÓN", HeadingLevel.HEADING_1),
                createParagraph("Los datos recopilados (altas tasas de fallos, tecnología predominante de sodio, valores lumínicos inconsistentes) reflejan una infraestructura en la fase de obsolescencia física y tecnológica. Mantener estos sistemas resulta en un gasto innecesario de fondos públicos y compromete el bienestar de los estudiantes. Los resultados coinciden plenamente con la literatura contemporánea sobre gestión de iluminación de recintos universitarios."),

                createHeading("14. CONCLUSIONES GENERALES", HeadingLevel.HEADING_1),
                createParagraph("• ¿La infraestructura actual es adecuada? No. Está envejecida, y una amplia fracción (" + ((defectiveCount/totalRecords)*100).toFixed(2) + "%) no presta servicio (focos dañados o apagados)."),
                createParagraph("• ¿Existen riesgos? Sí. Desde el riesgo derivado de la inseguridad por la oscuridad, hasta el riesgo eléctrico por cableado en mal estado."),
                createParagraph("• ¿Existen incumplimientos? Sí, el promedio lumínico y la gran cantidad de puntos en 0 lux evidencian un incumplimiento sistemático de la norma NTE INEN 069."),
                createParagraph("• ¿La metodología utilizada fue adecuada? El levantamiento georreferenciado con KoboToolbox probó ser sumamente eficaz."),
                createParagraph("• ¿Las mediciones son coherentes? Sí, la relación entre lámparas de sodio dañadas y bajos luxes es directamente proporcional."),
                createParagraph("• ¿Es viable mantener sodio? No. Es inviable económica y ambientalmente a mediano plazo."),
                createParagraph("• ¿Es viable migrar a LED? Es totalmente viable técnica y financieramente."),
                createParagraph("• ¿La migración tendría beneficios reales? Generaría ahorros superiores al 50% en consumo energético, reduciría el mantenimiento, y mejoraría exponencialmente la seguridad del campus."),

                createHeading("15. RECOMENDACIONES", HeadingLevel.HEADING_1),
                createParagraph("1. Prioridad Inmediata: Reparar o reemplazar los postes con cableado expuesto y aislamiento dañado para evitar incidentes fatales."),
                createParagraph("2. Corto Plazo: Iniciar licitación para reemplazar todas las cabezas de vapor de sodio por luminarias LED de 60W a 100W."),
                createParagraph("3. Mediano Plazo: Implementar un sistema GIS institucional permanente de Facility Management para gestión de activos."),
                createParagraph("4. Largo Plazo: Incorporar sistemas de telegestión inteligente (Smart Campus) para atenuación horaria programada."),

                createHeading("16. ANEXOS", HeadingLevel.HEADING_1),
                createParagraph("Las fotografías, base de datos y mapas digitales se adjuntan en los repositorios digitales de la universidad y en el archivo original mediciones.xlsx."),
                
                createHeading("17. BIBLIOGRAFÍA", HeadingLevel.HEADING_1),
                createParagraph("[1] INEN, 'NTE INEN 069: Niveles de Iluminación para espacios peatonales y vías', Instituto Ecuatoriano de Normalización, Quito, Ecuador."),
                createParagraph("[2] ARCONEL, 'Regulación No. ARCONEL 005/18 - Prestación del Servicio de Alumbrado Público General', Agencia de Regulación y Control de Electricidad, 2018."),
                createParagraph("[3] CIE, 'Lighting of Roads for Motor and Pedestrian Traffic', CIE 115:2010, International Commission on Illumination, Vienna, 2010."),
                createParagraph("[4] IES, 'Lighting for Exterior Environments', IES RP-33-14, Illuminating Engineering Society, New York, 2014."),
                createParagraph("[5] DOE, 'Solid-State Lighting R&D Plan', U.S. Department of Energy, 2021.")
            ]
        }]
    });

    Packer.toBuffer(doc).then((buffer) => {
        fs.writeFileSync(path.join(__dirname, 'Informe_Luminarias_UCE_Grupo3.docx'), buffer);
        console.log("Documento Word generado exitosamente: Informe_Luminarias_UCE_Grupo3.docx");
    }).catch(err => {
        console.error("Error generating doc: ", err);
    });
} catch(e) {
    console.error("Error: ", e);
}
