// Gender guessed from a Spanish first name, to save a question in the person
// form. Only a suggestion: the form always lets it be changed. Names are
// stored folded (lowercase, no accents).
import type { Gender } from '../types/domain';
import { foldText } from './text';

const MALE = new Set('luca josema aaron abel abelardo abraham adam adan adolfo adrian agustin aitor alan alberto alejandro alex alexander alexis alfonso alfredo alonso alvaro amadeo amador amancio ambrosio anastasio andres angel anibal anselmo antonio aquilino ariel aristides armando arnau arturo asier augusto aurelio baltasar bartolome basilio benito benjamin bernardo bienvenido blas borja bruno camilo candido carlos carmelo casimiro cayetano cecilio celestino cesar cipriano ciro clemente cristian cristobal damian daniel dario david diego dionisio domingo edgar eduardo efren eladio elias eloy emilio enrique eric erik ernesto esteban eugenio eusebio evaristo ezequiel fabian facundo faustino federico felipe felix fermin fernando fidel florencio francisco fulgencio gabriel gaspar gerardo german gilberto gonzalo gorka gregorio guillermo gustavo hector heriberto hernan hilario horacio hugo humberto ignacio inaki isaac isidro ismael ivan izan jacinto jacobo jaime javier jesus joan joaquin joel jordi jorge jose josep josue juan julian julio justo kevin lazaro leandro leo leon leonardo leopoldo lorenzo lucas luciano lucio luis manuel marc marcelino marcelo marcial marcos mariano mario martin mateo matias mauricio maximiliano maximo miguel moises nacho nahuel narciso nestor nicolas norberto octavio omar oriol oscar osvaldo pablo paco pascual patricio pau pedro pelayo pepe placido quim rafael ramiro ramon raul reinaldo ricardo roberto rodrigo rogelio rolando roman ruben rufino salvador samuel santiago saturnino sebastian sergio severiano silvio simon telmo teodoro tomas toni ubaldo unai urbano valentin valeriano vicente victor victoriano virgilio xabier xavier yago yeray zacarias'.split(' '));
const FEMALE = new Set('abigail ada adela adelaida adriana africa agata agueda aida ainara ainhoa aitana alba alejandra alexandra alicia alma almudena amalia amaya amelia amparo ana anabel andrea angela angeles angelica angustias antonia anunciacion araceli arantxa ariadna ascension asuncion aurora azucena barbara beatriz begona belen berta blanca bruna camila candela carla carlota carmen carolina casilda catalina cayetana cecilia celia chelo clara claudia concepcion consuelo covadonga cristina cynthia daniela debora delia diana dolores dulce elena eleonora elisa elsa elvira emilia emma encarna encarnacion erica erika esperanza estefania estela ester esther eugenia eulalia eva fatima felisa fernanda filomena flor florencia francisca gabriela gema gemma genoveva gloria gracia graciela guadalupe herminia hortensia ines ingrid inmaculada irene iris isabel itziar ivonne jacinta jessica jimena josefa josefina juana judit julia juliana julieta laia lara laura leire leonor leticia lidia liliana lola lorena lourdes lucia luisa luz macarena magdalena maite manuela mar marcela margarita maria mariana marina marisa marisol marta martina matilde mercedes milagros minerva mireia miriam monica montse montserrat nadia natalia nerea nieves noelia noemi nora nuria olga olivia paloma pamela paola patricia paula paulina pepa piedad pilar purificacion raquel rebeca regina remedios rocio rosa rosalia rosario roser ruth sabina salome samanta sandra sara silvia sofia soledad sonia susana tamara tania teresa trinidad valentina valeria vanesa vega veronica victoria violeta virginia yolanda zaira zoe'.split(' '));

/**
 * «María José» → mujer, «José María» → hombre (the first name decides),
 * «Gonzalo» → hombre. Unknown names fall back to the usual Spanish endings
 * (-a → mujer, -o → hombre); anything else is undefined (the form asks).
 */
export function guessGender(firstName: string): Gender | undefined {
  const first = foldText(firstName.trim()).split(/[\s-]+/)[0] ?? '';
  if (!first) return undefined;
  if (MALE.has(first)) return 'hombre';
  if (FEMALE.has(first)) return 'mujer';
  if (first.endsWith('a')) return 'mujer';
  if (first.endsWith('o')) return 'hombre';
  return undefined;
}
