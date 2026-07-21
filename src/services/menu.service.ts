import prisma from '@/database';
import { ApiError, HttpStatus } from '@/types';
import type { MenuItemInput, UpdateMenuItemInput, MenuQueryInput } from '@/validators';

export class MenuService {
  // Create a new menu item
  static async createMenuItem(data: MenuItemInput) {
    const { addOns, images, ...menuItemData } = data;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: menuItemData.categoryId },
    });

    if (!category) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Category not found');
    }

    // Check if slug already exists
    const existingSlug = await prisma.menuItem.findUnique({
      where: { slug: menuItemData.slug },
    });

    if (existingSlug) {
      throw new ApiError(HttpStatus.CONFLICT, 'Slug already exists');
    }

    // Create menu item with add-ons and images
    const menuItem = await prisma.menuItem.create({
      data: {
        ...menuItemData,
        addOns: addOns
          ? {
              create: addOns.map((addOn) => ({
                name: addOn.name,
                price: addOn.price,
                isRequired: addOn.isRequired || false,
                maxSelections: addOn.maxSelections || 1,
              })),
            }
          : undefined,
        images: images
          ? {
              create: images.map((image) => ({
                imageUrl: image.imageUrl,
                sortOrder: image.sortOrder || 0,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        addOns: true,
        images: true,
      },
    });

    return menuItem;
  }

  // Get menu item by ID
  static async getMenuItemById(id: string) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: true,
        addOns: true,
        images: true,
      },
    });

    if (!menuItem) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Menu item not found');
    }

    if (menuItem.isDeleted) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Menu item has been deleted');
    }

    return menuItem;
  }

  // Get menu item by slug
  static async getMenuItemBySlug(slug: string) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { slug },
      include: {
        category: true,
        addOns: true,
        images: true,
      },
    });

    if (!menuItem) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Menu item not found');
    }

    if (menuItem.isDeleted) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Menu item has been deleted');
    }

    return menuItem;
  }

  // Update menu item
  static async updateMenuItem(id: string, data: UpdateMenuItemInput) {
    const { addOns, images, ...menuItemData } = data;

    // Check if menu item exists
    const existingItem = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Menu item not found');
    }

    if (existingItem.isDeleted) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Cannot update deleted menu item');
    }

    // Check if slug is being changed and if new slug already exists
    if (menuItemData.slug && menuItemData.slug !== existingItem.slug) {
      const existingSlug = await prisma.menuItem.findUnique({
        where: { slug: menuItemData.slug },
      });

      if (existingSlug) {
        throw new ApiError(HttpStatus.CONFLICT, 'Slug already exists');
      }
    }

    // Update menu item
    const menuItem = await prisma.menuItem.update({
      where: { id },
      data: {
        ...menuItemData,
        addOns: addOns
          ? {
              deleteMany: {},
              create: addOns.map((addOn) => ({
                name: addOn.name,
                price: addOn.price,
                isRequired: addOn.isRequired || false,
                maxSelections: addOn.maxSelections || 1,
              })),
            }
          : undefined,
        images: images
          ? {
              deleteMany: {},
              create: images.map((image) => ({
                imageUrl: image.imageUrl,
                sortOrder: image.sortOrder || 0,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        addOns: true,
        images: true,
      },
    });

    return menuItem;
  }

  // Soft delete menu item
  static async deleteMenuItem(id: string) {
    const existingItem = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Menu item not found');
    }

    if (existingItem.isDeleted) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Menu item already deleted');
    }

    await prisma.menuItem.update({
      where: { id },
      data: { isDeleted: true, isAvailable: false },
    });

    return { message: 'Menu item deleted successfully' };
  }

  // Get menu items with filtering, search, pagination, and sorting
  static async getMenuItems(query: MenuQueryInput) {
    const { category, featured, available, search, page, limit, sort } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isDeleted: false,
    };

    if (category) {
      const categoryRecord = await prisma.category.findUnique({
        where: { slug: category },
      });

      if (categoryRecord) {
        where.categoryId = categoryRecord.id;
      }
    }

    if (featured === 'true') {
      where.isFeatured = true;
    }

    if (available === 'true') {
      where.isAvailable = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build order by clause
    let orderBy: any = {};
    switch (sort) {
      case 'price-asc':
        orderBy = { price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { price: 'desc' };
        break;
      case 'name-asc':
        orderBy = { name: 'asc' };
        break;
      case 'name-desc':
        orderBy = { name: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Get total count
    const total = await prisma.menuItem.count({ where });

    // Get menu items
    const menuItems = await prisma.menuItem.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        category: true,
        addOns: true,
        images: true,
      },
    });

    return {
      data: menuItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get featured menu items
  static async getFeaturedMenuItems(limit = 10) {
    const menuItems = await prisma.menuItem.findMany({
      where: {
        isFeatured: true,
        isAvailable: true,
        isDeleted: false,
      },
      take: limit,
      orderBy: { sortOrder: 'asc' },
      include: {
        category: true,
        addOns: true,
        images: true,
      },
    });

    return menuItems;
  }

  // Get menu items by category slug
  static async getMenuItemsByCategorySlug(categorySlug: string, page = 1, limit = 20) {
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Category not found');
    }

    const skip = (page - 1) * limit;

    const [menuItems, total] = await Promise.all([
      prisma.menuItem.findMany({
        where: {
          categoryId: category.id,
          isAvailable: true,
          isDeleted: false,
        },
        skip,
        take: limit,
        orderBy: { sortOrder: 'asc' },
        include: {
          category: true,
          addOns: true,
          images: true,
        },
      }),
      prisma.menuItem.count({
        where: {
          categoryId: category.id,
          isAvailable: true,
          isDeleted: false,
        },
      }),
    ]);

    return {
      category,
      data: menuItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
