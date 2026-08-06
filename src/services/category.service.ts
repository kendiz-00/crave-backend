import prisma from '@/database';
import { ApiError, HttpStatus } from '@/types';
import type { CategoryInput, UpdateCategoryInput } from '@/validators';

export class CategoryService {
  // Create a new category
  // Uses transaction for atomic creation with slug validation
  static async createCategory(data: CategoryInput) {
    return prisma.$transaction(async (tx) => {
      // Check if slug already exists
      const existingSlug = await tx.category.findUnique({
        where: { slug: data.slug },
      });

      if (existingSlug) {
        throw new ApiError(HttpStatus.CONFLICT, 'Slug already exists');
      }

      const category = await tx.category.create({
        data,
      });

      return category;
    });
  }

  // Get all categories
  static async getAllCategories() {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return categories;
  }

  // Get category by ID
  static async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        menuItems: {
          where: {
            isAvailable: true,
            isDeleted: false,
          },
          orderBy: { sortOrder: 'asc' },
          include: {
            addOns: true,
            images: true,
          },
        },
      },
    });

    if (!category) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Category not found');
    }

    return category;
  }

  // Get category by slug
  static async getCategoryBySlug(slug: string) {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        menuItems: {
          where: {
            isAvailable: true,
            isDeleted: false,
          },
          orderBy: { sortOrder: 'asc' },
          include: {
            addOns: true,
            images: true,
          },
        },
      },
    });

    if (!category) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Category not found');
    }

    return category;
  }

  // Update category
  // Uses transaction for atomic update with slug validation
  static async updateCategory(id: string, data: UpdateCategoryInput) {
    return prisma.$transaction(async (tx) => {
      // Check if category exists
      const existingCategory = await tx.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Category not found');
      }

      // Check if slug is being changed and if new slug already exists
      if (data.slug && data.slug !== existingCategory.slug) {
        const existingSlug = await tx.category.findUnique({
          where: { slug: data.slug },
        });

        if (existingSlug) {
          throw new ApiError(HttpStatus.CONFLICT, 'Slug already exists');
        }
      }

      const category = await tx.category.update({
        where: { id },
        data,
      });

      return category;
    });
  }

  // Delete category (soft delete by setting isActive to false)
  static async deleteCategory(id: string) {
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Category not found');
    }

    // Check if category has menu items
    const menuItemCount = await prisma.menuItem.count({
      where: {
        categoryId: id,
        isDeleted: false,
      },
    });

    if (menuItemCount > 0) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'Cannot delete category with existing menu items'
      );
    }

    await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Category deleted successfully' };
  }
}
