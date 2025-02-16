import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const db = createClient({
    url: process.env.url,
    authToken: process.env.authToken,
});


export async function showMenu() {
    try {
        const consult = await db.execute({
            sql: `
                SELECT 
                    m.id,
                    m.precio_total,
                    h.nombre AS hamburguesa_nombre,
                    h.precio AS hamburguesa_precio,
                    h.descripcion,
                    h.acompanamiento,
                    b.nombre AS bebida_nombre,
                    b.precio AS bebida_precio,
                    b.tamano AS bebida_tamano
                FROM menu m
                JOIN hamburguesas h ON m.hamburguesa_id = h.id
                JOIN bebidas b ON m.bebida_id = b.id;
            `,
            args: []
        });
        const menuJson = JSON.stringify(consult.rows);
        return menuJson;
    } catch (error) {
        console.error(error);
        return { error: error.message };
    }
}

export async function showDrinks() {
    try {
        const consult = await db.execute({
            sql: `
                SELECT * FROM bebidas;
            `,
            args: []
        });
        const drinksJson = JSON.stringify(consult.rows);
        return drinksJson;
    } catch (error) {
        console.error(error);
        return { error: error.message };
    }
}
