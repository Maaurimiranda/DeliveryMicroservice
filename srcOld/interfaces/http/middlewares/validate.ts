import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Middleware genérico de validación usando Zod v4
 * 
 * Valida el request (params, query, body) contra un schema de Zod
 * y retorna errores 400 con detalles si la validación falla.
 * 
 * @param schema - Schema de Zod para validar
 */
export const validate = (schema: z.ZodType<any, any, any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validar el request completo (params, query, body)
      // En Zod v4, parse es síncrono y lanza errores si falla
      const validated = schema.parse({
        params: req.params,
        query: req.query,
        body: req.body
      });

      // Reemplazar con datos validados y transformados
      req.params = validated.params || req.params;
      req.query = validated.query || req.query;
      req.body = validated.body || req.body;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Formatear errores de Zod v4
        // En v4, issues contiene los errores de validación
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code
        }));

        res.status(400).json({
          error: "Validación fallida",
          message: "Los datos enviados no son válidos",
          code: "VALIDATION_ERROR",
          errors: formattedErrors
        });
        return;
      }

      // Error inesperado
      console.error("Error inesperado en validación:", error);
      res.status(500).json({
        error: "Error interno",
        message: "Error al validar la solicitud",
        code: "VALIDATION_INTERNAL_ERROR"
      });
    }
  };
};

/**
 * Middleware para validar solo el body
 */
export const validateBody = (schema: z.ZodType<any, any, any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code
        }));

        res.status(400).json({
          error: "Validación fallida",
          message: "El cuerpo de la solicitud no es válido",
          code: "BODY_VALIDATION_ERROR",
          errors: formattedErrors
        });
        return;
      }

      res.status(500).json({
        error: "Error interno",
        message: "Error al validar el cuerpo de la solicitud"
      });
    }
  };
};

/**
 * Middleware para validar solo params
 */
export const validateParams = (schema: z.ZodType<any, any, any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code
        }));

        res.status(400).json({
          error: "Validación fallida",
          message: "Los parámetros de la URL no son válidos",
          code: "PARAMS_VALIDATION_ERROR",
          errors: formattedErrors
        });
        return;
      }

      res.status(500).json({
        error: "Error interno",
        message: "Error al validar los parámetros"
      });
    }
  };
};

/**
 * Middleware para validar solo query
 */
export const validateQuery = (schema: z.ZodType<any, any, any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code
        }));

        res.status(400).json({
          error: "Validación fallida",
          message: "Los parámetros de consulta no son válidos",
          code: "QUERY_VALIDATION_ERROR",
          errors: formattedErrors
        });
        return;
      }

      res.status(500).json({
        error: "Error interno",
        message: "Error al validar los parámetros de consulta"
      });
    }
  };
};