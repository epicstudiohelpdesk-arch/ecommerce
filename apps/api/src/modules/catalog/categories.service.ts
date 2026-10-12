import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import type { CategoryDto } from '@repo/api-contracts';

const DEFAULT_CATEGORIES = [
  {
    name: 'Pottery & Ceramics',
    slug: 'pottery-ceramics',
    description:
      'Handcrafted earthenware, terracotta kulhads, stoneware dinnerware, and ceramic vases.',
    displayOrder: 1,
  },
  {
    name: 'Woodcrafts & Carvings',
    slug: 'woodcrafts-carvings',
    description: 'Hand-carved wooden sculptures, teak bowls, spice boxes, and artisan furniture.',
    displayOrder: 2,
  },
  {
    name: 'Handmade Jewellery',
    slug: 'handmade-jewellery',
    description:
      'Filigree silver, terracotta beads, tribal brass, and handcrafted semi-precious stone jewellery.',
    displayOrder: 3,
  },
  {
    name: 'Textiles & Handloom',
    slug: 'textiles-handloom',
    description: 'Handloom sarees, kalamkari stoles, block-printed dupattas, and khadi fabrics.',
    displayOrder: 4,
  },
  {
    name: 'Paintings & Folk Art',
    slug: 'paintings-folk-art',
    description:
      'Original canvas paintings, Madhubani folk art, Tanjore gold foil, and Warli paintings.',
    displayOrder: 5,
  },
  {
    name: 'Customised & Heritage Gifts',
    slug: 'customised-heritage-gifts',
    description:
      'Personalised wooden keepsakes, custom engraved brassware, and bespoke bridal gifts.',
    displayOrder: 6,
  },
];

@Injectable()
export class CategoriesService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Retrieves all categories, auto-populating default craft categories if table is empty.
   */
  async listCategories(activeOnly = true): Promise<CategoryDto[]> {
    let rows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.categories)
      .orderBy(asc(this.databaseService.schema.categories.displayOrder));

    if (rows.length === 0) {
      // Auto-populate default categories
      for (const cat of DEFAULT_CATEGORIES) {
        await this.databaseService.db
          .insert(this.databaseService.schema.categories)
          .values({
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            displayOrder: cat.displayOrder,
            isActive: true,
          })
          .onConflictDoNothing();
      }

      rows = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.categories)
        .orderBy(asc(this.databaseService.schema.categories.displayOrder));
    }

    const filtered = activeOnly ? rows.filter((r) => r.isActive) : rows;

    return filtered.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      name: r.name,
      slug: r.slug,
      description: r.description,
      imageUrl: r.imageUrl,
      commissionRateBps: r.commissionRateBps,
      isActive: r.isActive,
      displayOrder: r.displayOrder,
    }));
  }

  async getCategoryById(id: string): Promise<CategoryDto> {
    const [cat] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.categories)
      .where(eq(this.databaseService.schema.categories.id, id))
      .limit(1);

    if (!cat) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return {
      id: cat.id,
      parentId: cat.parentId,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      commissionRateBps: cat.commissionRateBps,
      isActive: cat.isActive,
      displayOrder: cat.displayOrder,
    };
  }

  async getCategoryBySlug(slug: string): Promise<CategoryDto> {
    const [cat] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.categories)
      .where(eq(this.databaseService.schema.categories.slug, slug))
      .limit(1);

    if (!cat) {
      throw new NotFoundException(`Category with slug '${slug}' not found`);
    }

    return {
      id: cat.id,
      parentId: cat.parentId,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      commissionRateBps: cat.commissionRateBps,
      isActive: cat.isActive,
      displayOrder: cat.displayOrder,
    };
  }
}
