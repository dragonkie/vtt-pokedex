class pokeapi {
    static url = 'https://pokeapi.co/api/v2/';
    static async berry(name = '') { return await this.request(this.url + 'berry/' + name) };
    static async item(name = '') { return await this.request(this.url + 'item/' + name) };
    static async move(name = '') { return await this.request(this.url + 'move/' + name) };
    static async pokemon(name = '') { return await this.request(this.url + 'pokemon/' + name) };
    static async species(name = '') { return await this.request(this.url + 'pokemon-species/' + name) };
    static async egg(name = '') { return await this.request(this.url + 'egg-group/' + name) };
    static async evoloution(name = '') { return await this.request(this.url + 'evolution-chain/' + name) };

    static async request(url) {
        try {
            let request = await fetch(url);
            if (!request.ok) throw new Error(`pokeAPI request failed: ${request.status}`);
            return await request.json();
        } catch (error) {
            console.error('Request failed, returning null');
            return null
        }
    }

    // gets data and immedieatly ocnverts it to vtt data
    static async pokemonVTT(name) {
        if (name == '') console.error('vtt conversion must have an ID or NAME')
        let p = await this.pokemon(name);
        return await this._pokemonToVtt(p);
    }

    // converts API data into VTT usable json data
    static async _pokemonToVtt(poke) {
        const { data, species, evolution } = poke
        const pokemon = {
            name: data.name,
            weight: data.weight,
            height: data.height,
            dexID: data.id,
            types: [],
            evolution: []
        };
        pokemon.stats = {
            hp: { base: Math.round(data.stats[0].base_stat / 10) * 6 },
            atk: { base: Math.round(data.stats[1].base_stat / 10) },
            def: { base: Math.round(data.stats[2].base_stat / 10) },
            satk: { base: Math.round(data.stats[3].base_stat / 10) },
            sdef: { base: Math.round(data.stats[4].base_stat / 10) },
            spd: { base: Math.round(data.stats[5].base_stat / 10) }
        };
        for (const a of data.types) pokemon.types.push(a.type.name);

        //adds list of pokemon evoloution options, in order

        let chain = evolution.chain;

        const getChain = (evo) => {
            pokemon.evolution.push(evo.species);
            for (const e of evo.evolves_to) {
                getChain(e);
            }
        }
        getChain(chain);

        return pokemon;
    }
}

function titleCase(string) {
    if (!string) return '';
    return string[0].toUpperCase() + string.slice(1).toLowerCase();
}

window.addEventListener('load', async (event) => {
    console.log('Content loaded succesfuly');

    const pokedex = {
        names: []
    }

    const apinames = await pokeapi.pokemon('?limit=100000&offset=0');
    let dataset = document.getElementById('pokemon-names');

    for (const i of apinames.results) pokedex.names.push(i.name);
    pokedex.names.sort();// sort names alphabetically for faster search queries

    console.log(pokedex);

    /**********************************************************************************/
    /*                                                                                */
    /*                          SEARCH BAR AUTOCOMPLET                                */
    /*                                                                                */
    /**********************************************************************************/
    const searchbox = document.getElementById('search-name');
    searchbox.addEventListener('input', (event) => {
        dataset = document.getElementById('pokemon-names');
        const query = searchbox.value.toLowerCase();
        const matches = [];

        if (query.length < 2) return;
        let dist = Math.floor(pokedex.names.length - 1) / 2;
        let index = dist;
        let done = false;
        let final = false;

        //compare the strings and get five results
        while (!done) {
            if (final) return;
            // halves the distance the jump can be, if it hits 0 we fucked up and break the loop
            dist = dist / 2;
            if (dist <= 0.5) final = true;
            dist = Math.round(dist);
            index = Math.min(Math.max(Math.round(index), 0), pokedex.names.length - 1);
            let dir = query.localeCompare(pokedex.names[index].substring(0, query.length))
            if (dir > 0) {// positive means search is farther ahead
                index += dist;
            } else if (dir < 0) { // negative Means the search query is before
                index -= dist;
            } else { // the two are equal
                //this means an exact match, we can work backwards from here until we no longer match then return the first five results
                done = true;
                // we need to loop backwards from this index until it no longer matches, as soon as it doesnt, we can leave the loop and pass the matching results from there
                let backtracking = true;
                let offset = 0;
                while (backtracking) {
                    if (index - offset < 0) {
                        index = 0;
                        offset = 0;
                        backtracking = false;
                    } else if (query.localeCompare(pokedex.names[index - offset].substring(0, query.length)) != 0) {
                        offset -= 1;
                        backtracking = false;
                    }

                    if (!backtracking) {
                        for (let i = 0; i < 5; i++) {
                            if (query.localeCompare(pokedex.names[index - offset + i].substring(0, query.length) == 0)) matches.push(pokedex.names[index - offset + i]);
                        }
                    } else offset += 1;
                }
            }
            // insurance to make sure the index can't go out of scope
            index = Math.min(Math.max(Math.round(index), 0), pokedex.names.length - 1);
        }
        // create new elements
        let newDataset = document.createElement('datalist');
        newDataset.id = 'pokemon-names';
        for (const m of matches) {
            const e = document.createElement('option');
            e.value = m;
            newDataset.appendChild(e);
        }
        dataset.replaceWith(newDataset);
    })

    /**********************************************************************************/
    /*                                                                                */
    /*                          SEARCH BUTTON FUNCTIONALITY                           */
    /*                                                                                */
    /**********************************************************************************/
    let btnSearch = document.querySelector('#search');
    btnSearch.disabled = false;
    btnSearch.addEventListener('click', async (event) => {
        let name = searchbox.value.toLowerCase();
        if (name != '') {
            let pokemon = {};

            pokemon.data = await pokeapi.pokemon(name);
            pokemon.species = await pokeapi.species(name);
            pokemon.evolution = await pokeapi.request(pokemon.species.evolution_chain.url);
            pokemon.vtt = await pokeapi._pokemonToVtt(pokemon);

            searchbox.value = '';

            // Names
            document.getElementById('name').textContent = titleCase(pokemon.vtt.name);

            // Portrait
            document.getElementById('portrait').src = pokemon.data.sprites.front_default;

            //stats
            let stats = document.getElementById('stats');
            for (const stat of stats.querySelectorAll('[id]')) {
                stat.textContent = pokemon.vtt.stats[stat.id].base;
            }

            //height and weight
            document.getElementById('height').textContent = `${pokemon.vtt.height / 10}m`
            document.getElementById('weight').textContent = `${pokemon.vtt.weight / 10}kg`

            // Pokemon types
            document.getElementById('type-1').textContent = titleCase(pokemon.vtt.types[0]);
            document.getElementById('type-2').textContent = titleCase(pokemon.vtt.types[1]);

            // Egg groupings
            document.getElementById('egg-types').textContent = '';
            for (const egg of pokemon.species.egg_groups) {
                document.getElementById('egg-types').textContent += titleCase(egg.name + ' ');
            }

            // Bio descriptions and flavour text
            let bio = document.getElementById('bio');
            bio.replaceChildren();
            for (const i of pokemon.species.flavor_text_entries) {
                if (i.language.name == 'en') {
                    let e = document.createElement('div');
                    e.style.marginBottom = '8px';
                    e.style.maxWidth = '600px';

                    let ver = document.createElement('b');
                    ver.textContent = titleCase(i.version.name);

                    let flavor = document.createElement('div');
                    flavor.textContent = i.flavor_text;

                    e.appendChild(ver);
                    e.appendChild(flavor);
                    bio.appendChild(e);
                }
            }

            console.log(pokemon);
            document.getElementById('pokemon-data').classList.remove('no-display');
        }
    });

    /**********************************************************************************/
    /*                                                                                */
    /*                             POKEMON DATA TABS                                  */
    /*                                                                                */
    /**********************************************************************************/
}) 