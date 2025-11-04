import { Request, Response, NextFunction } from "express";
// import { validationResult } from "express-validator";
/*
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err: any) => ({
      field: err.type === 'field' ? err.path : err.param || 'unknown',
      message: err.msg,
      value: err.value,
      location: err.location
    }));

    res.status(400).json({
      error: "Validación fallida",
      message: "Los datos enviados no son válidos",
      code: "VALIDATION_ERROR",
      errors: formattedErrors
    });
    return;
  }

  next();
};
*/

/**
 * Validador personalizado para IDs de MongoDB/custom
 */
export const isValidId = (value: string): boolean => {
  // Validar formato de ID personalizado (ship_*, order_*, etc.)
  const customIdPattern = /^[a-z]+_[0-9]+_[a-z0-9]+$/;
  
  // O MongoDB ObjectId
  const mongoIdPattern = /^[0-9a-fA-F]{24}$/;
  
  return customIdPattern.test(value) || mongoIdPattern.test(value);
};

/**
 * Validador para estados de envío
 */
export const isValidShipmentStatus = (value: string): boolean => {
  const validStatuses = [
    "PENDING",
    "PREPARED",
    "IN_TRANSIT",
    "DELIVERED",
    "CANCELLED",
    "RETURNING",
    "RETURNED",
    "EXCHANGE_PROCESSED"
  ];
  
  return validStatuses.includes(value.toUpperCase());
};

/**
 * Validador para tipos de envío
 */
export const isValidShipmentType = (value: string): boolean => {
  const validTypes = ["NORMAL", "EXCHANGE"];
  return validTypes.includes(value.toUpperCase());
};

/**
 * Validador para información de cliente
 */
export const validateCustomerInfo = (customerInfo: any): string | true => {
  if (!customerInfo) {
    return "customerInfo es requerido";
  }

  if (typeof customerInfo !== "object") {
    return "customerInfo debe ser un objeto";
  }

  const required = ["customerId", "name", "address", "city", "zipCode", "phone"];
  
  for (const field of required) {
    if (!customerInfo[field] || typeof customerInfo[field] !== "string") {
      return `customerInfo.${field} es requerido y debe ser un string`;
    }

    if (customerInfo[field].trim() === "") {
      return `customerInfo.${field} no puede estar vacío`;
    }
  }

  return true;
};

/**
 * Validador para artículos
 */
export const validateArticles = (articles: any): string | true => {
  if (!articles) {
    return "articles es requerido";
  }

  if (!Array.isArray(articles)) {
    return "articles debe ser un array";
  }

  if (articles.length === 0) {
    return "articles no puede estar vacío";
  }

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    if (!article.articleId || typeof article.articleId !== "string") {
      return `articles[${i}].articleId es requerido y debe ser un string`;
    }

    if (article.quantity === undefined || typeof article.quantity !== "number") {
      return `articles[${i}].quantity es requerido y debe ser un número`;
    }

    if (article.quantity <= 0) {
      return `articles[${i}].quantity debe ser mayor a 0`;
    }

    if (article.price === undefined || typeof article.price !== "number") {
      return `articles[${i}].price es requerido y debe ser un número`;
    }

    if (article.price < 0) {
      return `articles[${i}].price no puede ser negativo`;
    }
  }

  return true;
};

/**
 * Middleware para sanitizar inputs
 */
export const sanitizeInputs = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Sanitizar strings en body
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }

  // Sanitizar query params
  if (req.query && typeof req.query === "object") {
    sanitizeObject(req.query);
  }

  // Sanitizar params
  if (req.params && typeof req.params === "object") {
    sanitizeObject(req.params);
  }

  next();
};

/**
 * Sanitiza un objeto recursivamente
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      // Trim whitespace
      obj[key] = obj[key].trim();
      
      // Remover caracteres peligrosos básicos
      obj[key] = obj[key].replace(/[<>]/g, "");
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * Validador de rango de paginación
 */
export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const limit = parseInt(req.query.limit as string);
  const skip = parseInt(req.query.skip as string);

  if (req.query.limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    res.status(400).json({
      error: "Parámetro inválido",
      message: "limit debe estar entre 1 y 100",
      code: "INVALID_PAGINATION"
    });
    return;
  }

  if (req.query.skip && (isNaN(skip) || skip < 0)) {
    res.status(400).json({
      error: "Parámetro inválido",
      message: "skip debe ser mayor o igual a 0",
      code: "INVALID_PAGINATION"
    });
    return;
  }

  next();
};

/**
 * Validador de formato de fecha
 */
export const isValidDate = (value: string): boolean => {
  const date = new Date(value);
  return !isNaN(date.getTime());
};

/**
 * Validador de teléfono (formato flexible)
 */
export const isValidPhone = (value: string): boolean => {
  // Acepta formatos: +54 11 1234-5678, 1112345678, etc.
  const phonePattern = /^[\d\s\-\+\(\)]+$/;
  return phonePattern.test(value) && value.replace(/\D/g, "").length >= 8;
};

/**
 * Validador de código postal
 */
export const isValidZipCode = (value: string): boolean => {
  // Formato flexible para diferentes países
  return value.length >= 4 && value.length <= 10;
};

/**
 * Middleware para validar headers requeridos
 */
export const validateRequiredHeaders = (requiredHeaders: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingHeaders = requiredHeaders.filter(
      header => !req.headers[header.toLowerCase()]
    );

    if (missingHeaders.length > 0) {
      res.status(400).json({
        error: "Headers faltantes",
        message: `Los siguientes headers son requeridos: ${missingHeaders.join(", ")}`,
        code: "MISSING_HEADERS",
        missingHeaders
      });
      return;
    }

    next();
  };
};

/**
 * Wrapper para validaciones custom
 */
export const customValidator = (
  validator: (value: any, req: Request) => boolean | Promise<boolean>,
  errorMessage: string
) => {
  return async (value: any, { req }: { req: Request }) => {
    const isValid = await validator(value, req);
    
    if (!isValid) {
      throw new Error(errorMessage);
    }
    
    return true;
  };
};

/**
 * Validador de estructura de objeto anidado
 */
export const validateNestedObject = (
  obj: any,
  schema: Record<string, any>
): string | true => {
  for (const key in schema) {
    const expectedType = schema[key];
    const value = obj[key];

    if (value === undefined || value === null) {
      return `Campo ${key} es requerido`;
    }

    if (typeof expectedType === "string") {
      if (typeof value !== expectedType) {
        return `Campo ${key} debe ser de tipo ${expectedType}`;
      }
    } else if (typeof expectedType === "object") {
      if (typeof value !== "object") {
        return `Campo ${key} debe ser un objeto`;
      }
      
      const nestedValidation = validateNestedObject(value, expectedType);
      if (nestedValidation !== true) {
        return `${key}.${nestedValidation}`;
      }
    }
  }

  return true;
};