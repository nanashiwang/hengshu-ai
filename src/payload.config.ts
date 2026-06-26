import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Categories } from './collections/Categories'
import { Skills } from './collections/Skills'
import { SkillVersions } from './collections/SkillVersions'
import { SkillRuns } from './collections/SkillRuns'
import { Reviews } from './collections/Reviews'
import { Favorites } from './collections/Favorites'
import { InviteCodes } from './collections/InviteCodes'
import { ContributionLogs } from './collections/ContributionLogs'
import { Bounties } from './collections/Bounties'
import { Reports } from './collections/Reports'
import { Media } from './collections/Media'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: '· 衡术 Hengshu',
    },
  },
  collections: [
    Users,
    Categories,
    Skills,
    SkillVersions,
    SkillRuns,
    Reviews,
    Favorites,
    InviteCodes,
    ContributionLogs,
    Bounties,
    Reports,
    Media,
  ],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    idType: 'uuid',
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || ''].filter(Boolean),
})
