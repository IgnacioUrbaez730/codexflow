import assert from "node:assert";
import { resolveFieldValue } from "../page";

describe("Evaluacion Desk Synonyms and Canonical Field Resolution", () => {
  it("resolves singular grandparents from plural abuelos_paternos", () => {
    const data = {
      abuelos_paternos: "Francisco de Paula Alcalá y Carmen Bermúdez",
    };
    assert.strictEqual(
      resolveFieldValue("abuelo_paterno", data),
      "Francisco de Paula Alcalá"
    );
    assert.strictEqual(
      resolveFieldValue("abuela_paterna", data),
      "Carmen Bermúdez"
    );
  });

  it("resolves singular grandparents from plural abuelos_maternos", () => {
    const data = {
      abuelos_maternos: "Manuel José Hurtado y María Concepción Morales",
    };
    assert.strictEqual(
      resolveFieldValue("abuelo_materno", data),
      "Manuel José Hurtado"
    );
    assert.strictEqual(
      resolveFieldValue("abuela_materna", data),
      "María Concepción Morales"
    );
  });

  it("resolves plural grandparents from singular keys", () => {
    const data = {
      abuelo_paterno: "José Alcalá",
      abuela_paterna: "Juana Ramos",
    };
    assert.strictEqual(
      resolveFieldValue("abuelos_paternos", data),
      "José Alcalá y Juana Ramos"
    );
  });

  it("resolves padrinos and singular padrino/madrina bidirectionally", () => {
    const data1 = {
      padrinos: "Pedro Pérez y Ana Gómez",
    };
    assert.strictEqual(resolveFieldValue("padrino", data1), "Pedro Pérez");
    assert.strictEqual(resolveFieldValue("madrina", data1), "Ana Gómez");

    const data2 = {
      padrino: "Carlos Ruiz",
      madrina: "Elena Blanco",
    };
    assert.strictEqual(
      resolveFieldValue("padrinos", data2),
      "Carlos Ruiz y Elena Blanco"
    );
  });

  it("resolves padre / nombre_padre and madre / nombre_madre bidirectionally", () => {
    assert.strictEqual(
      resolveFieldValue("nombre_padre", { padre: "Antonio José" }),
      "Antonio José"
    );
    assert.strictEqual(
      resolveFieldValue("padre", { nombre_padre: "Antonio José" }),
      "Antonio José"
    );
    assert.strictEqual(
      resolveFieldValue("nombre_madre", { madre: "Luisa Cáceres" }),
      "Luisa Cáceres"
    );
    assert.strictEqual(
      resolveFieldValue("madre", { nombre_madre: "Luisa Cáceres" }),
      "Luisa Cáceres"
    );
  });

  it("resolves subject names between nombres/apellidos and bautizado/difunto", () => {
    assert.strictEqual(
      resolveFieldValue("nombres", { bautizado: "Juan Bautista Arismendi" }),
      "Juan Bautista Arismendi"
    );
    assert.strictEqual(
      resolveFieldValue("bautizado", { nombres: "Juan Bautista", apellidos: "Arismendi" }),
      "Juan Bautista Arismendi"
    );
    assert.strictEqual(
      resolveFieldValue("difunto", { nombres: "Simón", apellidos: "Bolívar" }),
      "Simón Bolívar"
    );
  });

  it("resolves event dates across synonyms", () => {
    assert.strictEqual(
      resolveFieldValue("fecha_sacramento", { fecha_bautismo: "1810-04-19" }),
      "1810-04-19"
    );
    assert.strictEqual(
      resolveFieldValue("fecha_bautismo", { fecha_sacramento: "1821-06-24" }),
      "1821-06-24"
    );
    assert.strictEqual(
      resolveFieldValue("fecha_defuncion", { fecha_sacramento: "1830-12-17" }),
      "1830-12-17"
    );
  });
});
