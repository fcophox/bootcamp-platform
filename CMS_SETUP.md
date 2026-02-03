# Infraestructura CMS Multi-tenant

Este documento detalla la estructura de base de datos implementada utilizando Prisma y SQLite, diseñada para soportar un sistema multi-tenant de Landing Pages con soporte multiidioma.

## Estructura de Base de Datos (ERD)

La base de datos se ha configurado con las siguientes entidades:

### 1. Site (Sitio)
Representa un tenant o sitio web independiente.
- **id**: Identificador único.
- **name**: Nombre del sitio.
- **domain**: Dominio único (e.g., `example.com`).
- **branding**: Relación 1-1 con la configuración visual.
- **sections**: Relación 1-N con las secciones de contenido.
- **contactInfo**: Relación 1-1 con información de contacto.

### 2. Branding
Configuración visual específica de un sitio.
- **logoUrl**: URL del logo.
- **primaryColor**: Color primario (HEX).
- **secondaryColor**: Color secundario (HEX).
- **fontFamily**: Fuente tipográfica.

### 3. Language (Idioma)
Idiomas soportados por el sistema.
- **code**: Código ISO (e.g., 'en', 'es').
- **name**: Nombre legible (e.g., 'English').

### 4. Section (Sección)
Bloques de contenido dentro de un sitio (e.g., Hero, Features).
- **name**: Identificador interno de la sección.
- **order**: Orden de visualización.
- **templateId**: ID para seleccionar el diseño/componente.

### 5. ContentTranslation (Traducción)
Almacena el contenido textual localizado.
- Vincula `Section` + `Language` + `Key` -> `Value`.
- Permite traducir títulos, descripciones, botones, etc.

### 6. ContactInfo & FormSubmission
- **ContactInfo**: Datos de contacto del sitio.
- **FormSubmission**: Registros de formularios enviados.

---

## Esquema Prisma (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Site {
  id              String   @id @default(uuid())
  name            String
  domain          String   @unique
  branding        Branding?
  sections        Section[]
  contactInfo     ContactInfo?
  formSubmissions FormSubmission[]
  translations    ContentTranslation[]
}

model Language {
  id           String @id @default(uuid())
  code         String @unique
  name         String
  translations ContentTranslation[]
}

model Branding {
  id             String @id @default(uuid())
  siteId         String @unique
  site           Site   @relation(fields: [siteId], references: [id])
  logoUrl        String?
  primaryColor   String?
  secondaryColor String?
  fontFamily     String?
}

model Section {
  id           String @id @default(uuid())
  siteId       String
  site         Site   @relation(fields: [siteId], references: [id])
  name         String
  order        Int    @default(0)
  templateId   String? 
  translations ContentTranslation[]
}

model ContentTranslation {
  id           String @id @default(uuid())
  sectionId    String?
  section      Section? @relation(fields: [sectionId], references: [id])
  siteId       String?
  site         Site? @relation(fields: [siteId], references: [id])
  languageId   String
  language     Language @relation(fields: [languageId], references: [id])
  key          String
  value        String
  @@unique([sectionId, languageId, key])
  @@index([siteId])
}

model ContactInfo {
  id        String @id @default(uuid())
  siteId    String @unique
  site      Site   @relation(fields: [siteId], references: [id])
  phone     String?
  email     String?
  address   String?
  mapLat    Float?
  mapLng    Float?
  social    String?
}

model FormSubmission {
  id        String @id @default(uuid())
  siteId    String
  site      Site   @relation(fields: [siteId], references: [id])
  name      String
  email     String
  message   String
  createdAt DateTime @default(now())
}
```

---

## Ejemplo de Consulta (Prisma Client)

A continuación se muestra cómo consultar el contenido de una Landing Page para un dominio y un idioma específicos.

> **Nota**: Se utiliza Prisma Client ya que el proyecto se inicializó con SQLite/Prisma según la solicitud final.

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function getLandingPageContent(domain: string, languageCode: string) {
  // 1. Buscar el sitio por dominio con sus relaciones
  const site = await prisma.site.findUnique({
    where: { domain: domain },
    include: {
      branding: true,
      contactInfo: true,
      sections: {
        orderBy: { order: 'asc' }, // Ordenar secciones
        include: {
          translations: {
            where: {
              language: {
                code: languageCode // Filtrar traducciones solo del idioma solicitado
              }
            }
          }
        }
      }
    }
  })

  if (!site) {
    throw new Error('Site not found')
  }

  // 2. Formatear la respuesta para el frontend
  // Convertimos el array de traducciones en un objeto clave-valor simple
  const sectionsFormatted = site.sections.map(section => {
    const content = section.translations.reduce((acc, t) => {
      acc[t.key] = t.value
      return acc
    }, {} as Record<string, string>)

    return {
      id: section.id,
      name: section.name,
      template: section.templateId,
      content: content
    }
  })

  return {
    site: {
      name: site.name,
      branding: site.branding,
      contact: site.contactInfo
    },
    sections: sectionsFormatted
  }
}

// Uso
getLandingPageContent('my-landing.com', 'es')
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(e => console.error(e))
```
