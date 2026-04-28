const { createSwaggerSpec } = require('next-swagger-doc')
const fs = require('fs')
const path = require('path')

const spec = createSwaggerSpec({
    apiFolder: 'app/api',
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'My API Documentation',
            version: '1.0.0',
            description: 'API documentation for my Next.js app',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
            {
                url: 'https://story-teller-batrinutsilvius-projects.vercel.app',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token from the login endpoint'
                }
            }
        },
    },
})

fs.writeFileSync(
    path.join(__dirname, '../public/swagger.json'),
    JSON.stringify(spec, null, 2)
)

console.log('Swagger spec generated!')
