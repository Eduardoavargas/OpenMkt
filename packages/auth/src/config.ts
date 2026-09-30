export const openMktAuthDefaults = {
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      generateId: 'uuid' as const,
    },
  },
}
