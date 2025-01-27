class pokeapi {
    static url = 'https://pokeapi.co/api/v2/';
    static async berry(name = '') { return await this.request(this.url + 'berry/' + name) };
    static async item(name = '') { return await this.request(this.url + 'item/' + name) };
    static async move(name = '') { return await this.request(this.url + 'move/' + name) };
    static async pokemon(name = '') { return await this.request(this.url + 'pokemon/' + name) };
    static async species(name = '') { return await this.request(this.url + 'pokemon-species/' + name) };
    static async egg(name = '') { return await this.request(this.url + 'egg-group/' + name) };
    static async evolution(name = '') { return await this.request(this.url + 'evolution-chain/' + name) };

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
                pokemon.moves.push({
                    name: i.move.name,
                    level: d.level_learned_at,
                    method: d.move_learn_method.name,
                    data: await pokeapi.request(i.move.url),
                })

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

function isMobile() {
    return (window.matchMedia("(any-hover:none)").matches)
};

function mobileCheck() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
  };

/**********************************************************************************/
/*                                                                                */
/*                          WINDOW CONTENT LOADED FULLY                           */
/*                                                                                */
/**********************************************************************************/
window.addEventListener('load', async (event) => {

    // Adds mobile styling if we detect someone on a device without a mouse
    if (mobileCheck()) document.querySelector('body').classList.add('mobile');
    window.addEventListener('resize', () => {
        // Toggle mobile classes
        if (isMobile()) document.querySelector('body').classList.add('mobile');
        else document.querySelector('body').classList.remove('mobile');
    });

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
    async function proccessSearchForm(event) {
        console.log('Search Pending...')
        if (event.preventDefault) event.preventDefault();
        let name = searchbox.value.toLowerCase();
        if (name != '') {
            // Reveal the loading dots
            document.querySelector('.loading').classList.remove('no-display');
            document.getElementById('portrait').classList.add('no-display');

            // Load in data
            let pokemon = {};
            pokemon.data = await pokeapi.pokemon(name);
            pokemon.species = await pokeapi.species(name);
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
                w.classList.add('data-block');

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

        }
    }
    document.getElementById('search-form').addEventListener('submit', proccessSearchForm);
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

    /**********************************************************************************/
    /*                                                                                */
    /*                          LOADING SCREEN DOT DELAY                              */
    /*                                                                                */
    /**********************************************************************************/
    let delay = 0;
    let dots = document.querySelectorAll('.loading .dot');

    for (let i = 0; i < dots.length; i += 1) {
        let dot = dots[i];

        function triggerAnimation() {
            console.log('triggered');
            this.classList.remove('paused');
        }

        window.setTimeout(triggerAnimation.bind(dot), delay);
        delay += 250;
    }
}) 