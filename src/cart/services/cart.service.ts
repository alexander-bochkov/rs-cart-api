import { Injectable } from '@nestjs/common';
import { Client } from 'pg'
import { forEach } from 'p-iteration';

import { v4 } from 'uuid';

import { Cart } from '../models';

const {
  PG_HOST,
  PG_PORT,
  PG_DATABASE,
  PG_USERNAME,
  PG_PASSWORD,
} = process.env;

const dbOptions = {
  host: PG_HOST,
  port: parseInt(PG_PORT),
  database: PG_DATABASE,
  user: PG_USERNAME,
  password: PG_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 5000,
};

@Injectable()
export class CartService {
  private userCarts: Record<string, Cart> = {};

  async findByUserId(userId: string) {
    let result;

    const client = new Client(dbOptions);

    try {
      await client.connect();

      const { rows: [ cart ] } = await client.query(`SELECT id, status FROM carts WHERE user_id = '${userId}'`);

      if (!cart) return;

      const { rows: items } = await client.query(`SELECT product_id, count FROM cart_items WHERE cart_id = '${cart.id}'`);

      result = { ...cart, items };
    } catch (error) {
      console.error('findByUserId error: ', error.message);
    } finally {
      await client.end();
    }

    return result;
  }

  async createByUserId(userId: string) {
    let result;

    const client = new Client(dbOptions);

    try {
      await client.connect();

      await client.query(`
        insert into carts (user_id, created_at, updated_at, status) values
          ('${userId}', CURRENT_DATE, CURRENT_DATE, 'OPEN')
      `);

      // const { rows: [ cart ] } = await client.query(`SELECT id, status FROM carts WHERE user_id = '${userId}'`);
      result = await this.findByUserId(userId);
    } catch (error) {
      console.error('createByUserId error: ', error.message);
    } finally {
      await client.end();
    }

    return result;
  }

  async findOrCreateByUserId(userId: string) {
    const userCart = await this.findByUserId(userId);

    if (userCart) {
      return userCart;
    }

    return await this.createByUserId(userId);
  }

  async updateByUserId(userId: string, { items }) {
    let result;

    const { id } = await this.findOrCreateByUserId(userId);

    const client = new Client(dbOptions);

    try {
      await client.connect();

      await client.query(`DELETE FROM cart_items WHERE cart_id = '${id}'`);

      await forEach(items, async ({ product_id, count }: { product_id: string, count: number }) => {
        await client.query(`
          insert into cart_items (cart_id, product_id, count) values
            ('${id}', '${product_id}', ${count})
        `);
      });

      result = await this.findByUserId(userId);
      console.log(result);
    } catch (error) {
      console.error('updateByUserId error: ', error.message);
    } finally {
      await client.end();
    }

    return result;
  }

  async removeByUserId(userId) {
    const client = new Client(dbOptions);

    try {
      const { id } = await this.findOrCreateByUserId(userId);

      await client.connect();

      await client.query(`DELETE FROM cart_items WHERE cart_id = '${id}'`);
      await client.query(`DELETE FROM carts WHERE user_id = '${userId}'`);
    } catch (error) {
      console.error('removeByUserId error: ', error.message);
    } finally {
      await client.end();
    }
  }
}
