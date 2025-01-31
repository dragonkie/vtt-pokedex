class pokeapi {
    static url = 'https://pokeapi.co/api/v2/';
    static async berry(name = '') { return await this.request(this.url + 'berry/' + name) };
    static async egg(name = '') { return await this.request(this.url + 'egg-group/' + name) };
    static async evolution(name = '') { return await this.request(this.url + 'evolution-chain/' + name) };
    static async item(name = '') { return await this.request(this.url + 'item/' + name) };
    static async move(name = '') { return await this.request(this.url + 'move/' + name) };
    static async pokemon(name = '') { return await this.request(this.url + 'pokemon/' + name) };
    static async species(name = '') { return await this.request(this.url + 'pokemon-species/' + name) };
    static async type(name = '') { return await this.request(this.url + 'type/' + name) };

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
            evolution: {},
            moves: [],
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
        pokemon.evolution.chain = [];
        pokemon.evolution.id = evolution.id;
        pokemon.evolution.next = species
        pokemon.evolution.previous = species.evolves_from_species;

        // evolution_details repersents how a previous pokemon evolved *into* this one
        // evolves_to repersents possible options this pokemon can becom

        const parseChain = (chain) => {
            // Each evolution entry in the chain should have details used to help order itself
            let data = {
                from: [],//list of ways this pokemon came into existance
                details: undefined,
            }

            if (chain.evolution_details.length > 0) data.details = chain.evolution_details[0];
            if (chain.evolution_details.length > 1) console.error('Fuck there are multi method evos');

            // get details for future evolutions
            for (var i = 0; i < chain.evolves_to.length; i++) {
                pokemon.evolution.chain.push({
                    name: chain.species.name,
                    evolves_to: {
                        name: chain.evolves_to[i].species,
                    },
                });
                // if there is a further evoloution, parses it in
                if (chain.evolves_to[i]) parseChain(chain.evolves_to[i]);
            }
        }

        parseChain(evolution.chain);

        // Add pokemons level up available moves
        for (const i of data.moves) {
            for (const d of i.version_group_details) {
                if (d.move_learn_method.name == 'machine') continue;
                let skip = false;
                for (const f of pokemon.moves) if (f.name == i.move.name) skip = true;
                if (skip) continue;
                let data = await pokeapi.request(i.move.url)
                let _d = {
                    name: i.move.name,
                    level: d.level_learned_at,
                    method: d.move_learn_method.name,
                    data: data
                }
                _d.type = data.type.name;
                _d.category = data.meta.category.name;
                _d.accuracy = data.accuracy;
                _d.id = data.id;
                _d.ailment = {
                    name: data.meta.ailment.name,
                    chance: data.meta.ailment_chance,
                    turns: {
                        max: data.meta.max_turns,
                        min: data.meta.min_turns
                    }
                }

                pokemon.moves.push(_d);
            }
        }

        pokemon.moves.sort((a, b) => {
            return a.level - b.level;
        })

        // converts list of moves into PTA3 stat passives where possible
        // Make sure to filter out unavailable options before calculation
        let m = [];
        for (const n of pokemon.moves) if (n.method == 'level-up') m.push(n.name);
        let statBonus = this.movePassive(m);
        console.log(m);
        console.log(statBonus);

        return pokemon;
    }

    /**
     * converts a move based off of name into their respective stat changes
     * @param {string} move 
     * @returns {Object} an object with matching keys to default pokemon stats to be added
     */
    static movePassive(moves) {
        // santize the input to make sure it adheres to pokeapi formating
        if (!Array.isArray(moves)) moves = [moves];

        const stats = {
            atk: 0,
            def: 0,
            hp: 0,
            satk: 0,
            sdef: 0,
            spd: 0,
        }

        for (let move of moves) {
            move = move.toLowerCase().replaceAll(" ", "-");
            switch (move) {
                // Attack
                case 'gorilla-tactics':
                case 'howl':
                case 'leer':
                case 'meditate':
                case 'moxie':
                case 'sharpen':
                case 'tail-whip':
                    stats.atk += 1;
                    break;
                case 'hone-claws':
                case 'screech':
                case 'swords-dance':
                    stats.atk += 2;
                    break;
                case 'huge-power':
                case 'pure-power':
                    stats.atk += 6;
                    break;

                // Special Attack
                case 'metal-sound':
                case 'nasty-plot':
                    stats.satk += 1;
                    break;
                case 'fake-tears':
                    stats.satk += 2;
                    break;
                case 'tail-glow':
                    stats.satk += 3;
                    break;

                // Defence
                case 'baby-doll-eyes':
                case 'charm':
                case 'defense-curl':
                case 'growl':
                case 'harden':
                case 'intimidate':
                case 'play-nice':
                case 'withdraw':
                    stats.def += 1;
                    break;
                case 'acid-armor':
                case 'barrier':
                case 'feather-dance':
                case 'iron-defense':
                case 'stamina':
                    stats.def += 2;
                    break;
                case 'cotton-guard':
                case 'shelter':
                    stats.def += 3;
                    break;

                // Special Defence
                case 'confide':
                    stats.sdef += 1;
                    break;
                case 'amnesia':
                case 'captivate':
                case 'eerie-impulse':
                    stats.sdef += 2;
                    break;

                // Mixed stat gains
                case 'bulk-up':
                case 'tickle':
                    stats.atk += 1;
                    stats.def += 1;
                    break;
                case 'growth':
                case 'rototiller':
                case 'work-up':
                    stats.atk += 1;
                    stats.satk += 1;
                    break;
                case 'calm-mind':
                    stats.satk += 1;
                    stats.sdef += 1;
                    break;
                case 'coil':
                    stats.atk += 2;
                    stats.def += 1;
                    break;
                case 'cosmic-power':
                case 'tearful-look':
                    stats.def += 1;
                    stats.sdef += 1;
                    break;
                case 'dragon-dance':
                    stats.atk += 1;
                    stats.spd += 1;
                    break;
                case 'quiver-dance':
                    stats.spd += 1;
                    stats.satk += 1;
                    stats.sdef += 1;
                    break;
                case 'shift-gear':
                    stats.atk += 1;
                    stats.spd += 2;
                    break;
            }
        }

        return stats;
    }
}

function titleCase(string) {
    if (!string) return '';
    return string[0].toUpperCase() + string.slice(1).toLowerCase();
}

// DO IT!
function order66(element) {
    while (element.lastChild) element.removeChild(element.lastChild);
}

const pokedex = {
    names: [],
    eggs: [],
    moves: [],
    types: [],
}

/**********************************************************************************/
/*                                                                                */
/*                          WINDOW CONTENT LOADED FULLY                           */
/*                                                                                */
/**********************************************************************************/
window.addEventListener('load', async (event) => {
    // sync loading ring widths to screen size, and watch for it being deleted so it doesnt get evaporated
    const loadingContainer = document.querySelector('.loading');
    const loadingRings = document.querySelectorAll('.ring');
    const observerCallback = (list, observer) => {
        const rect = loadingContainer.getBoundingClientRect();
        for (const r of loadingRings) r.style.borderWidth = `${rect.width * 0.05}px`;
    }

    const loadingObserver = new MutationObserver(observerCallback);
    loadingObserver.observe(loadingContainer, { attributes: true, subtree: true });

    /**********************************************************************************/
    /*                                                                                */
    /*                    FILL IN POKEDEX FOR SEARCH INDEX                            */
    /*                                                                                */
    /**********************************************************************************/
    const _apiNames = await pokeapi.pokemon('?limit=100000&offset=0');
    const _apiEggs = await pokeapi.egg('?limit=100000&offset=0');
    const _apiMoves = await pokeapi.move('?limit=100000&offset=0');
    const _apiTypes = await pokeapi.type('?limit=100000&offset=0');

    const _dataNames = document.getElementById('pokemon-names');
    const _dataEggs = document.getElementById('pokemon-eggs');
    const _dataMoves = document.getElementById('pokemon-moves');
    const _dataTypes = document.getElementById('pokemon-types');

    for (const i of _apiNames.results) pokedex.names.push(i.name);
    for (const i of _apiEggs.results) pokedex.eggs.push(i.name);
    for (const i of _apiMoves.results) pokedex.moves.push(i.name);
    for (const i of _apiTypes.results) pokedex.types.push(i.name);

    pokedex.names.sort();// sort names alphabetically for faster search queries
    pokedex.eggs.sort();// sort names alphabetically for faster search queries
    pokedex.moves.sort();// sort names alphabetically for faster search queries
    pokedex.types.sort();// sort names alphabetically for faster search queries

    console.log(pokedex);

    /**********************************************************************************/
    /*                                                                                */
    /*                          SEARCH BAR AUTOCOMPLET                                */
    /*                                                                                */
    /**********************************************************************************/
    const searchbox = document.getElementById('search-name');
    searchbox.addEventListener('input', (event) => {
        console.log('updating auto complete list...');
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
        order66(_dataNames); // KILL THEM ALL!!! MUWAHAHAHAAHA
        console.log(matches);
        for (const m of matches) {
            const e = document.createElement('option');
            e.value = m;
            _dataNames.appendChild(e);
        }

    })

    /**********************************************************************************/
    /*                                                                                */
    /*                          SEARCH BUTTON FUNCTIONALITY                           */
    /*                                                                                */
    /**********************************************************************************/
    async function proccessSearchForm(event) {
        console.log('Search Pending...')
        if (event.preventDefault) event.preventDefault();
        let name = searchbox.value.toLowerCase();
        if (name != '') {
            // Reveal the loading dots
            document.querySelector('.loading').classList.remove('no-display');
            document.getElementById('portrait').classList.add('no-display');

            await (300);

            // Load in data
            let pokemon = {};
            pokemon.data = await pokeapi.pokemon(name);
            pokemon.species = await pokeapi.species(pokemon.data.species.name);
            pokemon.evolution = await pokeapi.request(pokemon.species.evolution_chain.url);
            pokemon.vtt = await pokeapi._pokemonToVtt(pokemon);

            // Names
            document.getElementById('name').textContent = titleCase(pokemon.vtt.name);

            // Portrait
            document.getElementById('portrait').src = pokemon.data.sprites.front_default;
            setTimeout(() => {
                document.querySelector('.loading').classList.add('no-display');
                document.getElementById('portrait').classList.remove('no-display');
            }, 50);

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
                    e.classList.add('data-block');

                    let ver = document.createElement('b');
                    ver.textContent = titleCase(i.version.name);

                    let flavor = document.createElement('div');
                    flavor.textContent = i.flavor_text;

                    e.appendChild(ver);
                    e.appendChild(flavor);
                    bio.appendChild(e);
                }
            }

            // Move sets to move tab
            let moves = document.getElementById('moves');
            moves.replaceChildren();

            for (const move of pokemon.vtt.moves) {
                let w = document.createElement('div');
                w.classList.add('move');
                w.classList.add(move.type);

                let n = document.createElement('b');
                n.textContent = move.name;
                for (const i of move.data.names) {
                    if (i.language.name != 'en') continue;
                    n.textContent = i.name;
                    break;
                }

                let f = document.createElement('div');
                for (const i of move.data.flavor_text_entries) {
                    if (i.language.name != 'en') continue;
                    f.textContent = i.flavor_text;
                    break;
                }

                moves.appendChild(w);
                w.appendChild(n);
                w.appendChild(f);
            }
            console.log(pokemon);
        }
    }
    document.getElementById('search').addEventListener('submit', proccessSearchForm);
    document.querySelector('#search-submit').disabled = false;

    /**********************************************************************************/
    /*                                                                                */
    /*                             POKEMON DATA TABS                                  */
    /*                                                                                */
    /**********************************************************************************/
    let nav = document.querySelectorAll('#navigation .tab-select');
    let tabs = document.querySelectorAll('#content .tab');
    for (const t of nav) {
        t.addEventListener('click', (event) => {
            for (const i of nav) i.classList.remove('active');
            for (const i of tabs) i.classList.remove('active');
            document.querySelector(`#${event.target.dataset.tab}`).classList.add('active');
            event.target.classList.add('active');
        })
    }
}) 