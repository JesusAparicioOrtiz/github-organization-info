'use strict'
const axios = require('axios');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

/*! Devuelve la información de una organización
 *  @param url un string con la url para llamar a la api de GitHub
 *  @param authHeader un objeto que contiene la autorización para la petición
 *  @return un objeto con la información de la organización
 */
const getOrganization = async (url, authHeader) => {
    const organization = await axios.get(url, authHeader).then((reponse) => {
        return reponse.data
    }).catch(err => {
        console.log('Catch', err);
    });
    return organization
}

/*! Devuelve la información de un repositorio
 *  @param repository un string con la url del repositorio para llamar a la api de GitHub
 *  @param authHeader un objeto que contiene la autorización para la petición
 *  @return un objeto con la información del repositorio
 */
const getRepositoryIssuesRequest =  (repository, authHeader) => {
    return axios.get(repository, authHeader).catch(err => {
        console.log('Catch', err);
    });
}

/*! Devuelve el número de issues a partir de una respuesta de la api que contiene
 *  información sobre un repositorio, cogiendo el primer issue que aparece, el cual
 *  contiene el número de issue que le corresponde. Como están ordenados de manera
 *  descendente, entonces ese es siempre el número de issues
 *  @param response una respuesta de la api al endpoint de un repositorio en concreto
 *  @return un número indicando el número de issues del repositorio
 */
const getRepositoryIssues =  (response) => {
    var repositoryIssues = 0
    var repositoryIssuesObjects = response.data
    if (repositoryIssuesObjects[0] != undefined) {
        repositoryIssues = repositoryIssuesObjects[0].number
    }
    return repositoryIssues
}

/*! Devuelve el número de páginas de repositorios, teniendo cada página un 
 *  tamaño de 100 repositorios (el máximo permitido)
 *  @param url un string con la url para llamar a la api de GitHub
 *  @param authHeader un objeto que contiene la autorización para la petición
 *  @param promisesRepositoryPages un array que contiene promesas de las páginas
 *  de los repositorios
 *  @return un número con el número de páginas de repositorios
 */
const getRepositoryPages = async (url, authHeader,promisesRepositoryPages) => {
    var repositoryPages = 0
    var promise = await axios.get(url + "/repos?per_page=100", authHeader)
    var linkHeader = String(promise.headers.link)
    if (linkHeader != 'undefined') {
        var regularExpression = new RegExp(/(\d+)(?!.*\d)/)
        repositoryPages = Number(regularExpression.exec(linkHeader)[0])
    }
    promisesRepositoryPages.push(promise)
    return repositoryPages
}

/*! Devuelve la información de los commits de un repositorio
 *  @param organization un objeto que contiene información sobre la organización
 *  @param repositoryName un string que representa el nombre de un repositorio
 *  @param authHeader un objeto que contiene la autorización para la petición
 *  @return un objeto con la información de los commits de un repositorio
 */
const getCommitsNumberRequest =  (organization, repositoryName, authHeader) => {
    return axios.get("https://api.github.com/repos/" + organization.login + "/" + repositoryName + "/commits?per_page=1", authHeader).catch(err => {
    });
}

/*! Devuelve el número de commits a partir de una respuesta de la api que contiene
 *  información sobre los commits repositorio. Ya que la respuesta pasada por 
 *  parámetro tiene la cabecera link con el número de páginas totales y cada página
 *  se ha indicado que tenga un único commit, entonces la última página es el
 *  número de commits del repositorio
 *  @param response una respuesta de la api al endpoint de los commmits de un
 *  repositorio concreto
 *  @return un número indicando el número de commits del repositorio
 */
const getCommitsNumber =  (response) => {
    var repositoryCommits = 0
    try{
        var linkHeader = String(response.headers.link)
        if (linkHeader != 'undefined') {
            var regularExpression = new RegExp(/(\d+)(?!.*\d)/)
            repositoryCommits = Number(regularExpression.exec(linkHeader)[0])
        }
    }catch{

    }
    return repositoryCommits
}

/*! Devuelve cierta información de un repositorio. En concreto el número de issues,
 *  el numéro de commits, el nombre del repositorio y sus issues abiertas.
 *  @param repository un objeto con información de un repositorio
 *  @param organization un objeto que contiene información sobre una organización
 *  @param authHeader un objeto que contiene la autorización para la petición
 *  @return un objeto cuyos atributos son los siguientes: "issues" un número
 *  indicando el número de issues, "commits" un número indicando el número de commits,
 *  "repositoryName" un string indicando el nombre del repositorio y "openIssues" un
 *  número indicando el número de issues abiertas del repositorio
 */
var getRepository = async (repository,organization,org,authHeader) => {
    var repositoryName = repository.name
    var repositoryIssuesRequest =  getRepositoryIssuesRequest("https://api.github.com/repos/" + org + "/" + repositoryName + "/issues", authHeader)
    var repositoryCommitsRequest =  getCommitsNumberRequest(organization, repositoryName, authHeader)
    
    var responses = await Promise.all([repositoryIssuesRequest,repositoryCommitsRequest])
    var repositoryIssues = getRepositoryIssues(responses[0])
    var repositoryCommits = getCommitsNumber(responses[1])

    return {"issues":repositoryIssues,"commits": repositoryCommits,"repositoryName":repositoryName,"openIssues":repository.open_issues_count}
}

/*! Devuelve cierta información de una serie de repositorios. En concreto el número
 *  de issues, el numéro de commits, el nombre del repositorio y sus issues abiertas.
 *  @param response un objeto con información sobre algunos repositorios de una organización
 *  @param organization un objeto que contiene información sobre una organización
 *  @param org un string que representa el nombre de una organización
 *  @param authHeader un objeto que contiene la autorización para la petición
 *  @return un array de objetos que contienen información sobre repositorios
 */
var getRepositories = (response,organization,org,authHeader) => {
    var repositories = response.data 
    var promises = []
    for (const repository of repositories) {
        var repositoryInfo = getRepository(repository,organization,org,authHeader)
        promises.push(repositoryInfo)
    }
    return promises
}

/*! Printea cierta información a partir de una organización
 *  @param org un string que representa el nombre de una organización
 *  @param token un string que sirve para realizar una autenticación en la
 *  petición de GitHub y de esta manera aumentar el número máximo de peticiones
 *  a la API
 */
const getOrganizationInfo = async (org, token) => {
    var totalIssues = 0;
    var totalCommits = 0;
    var auth = ""
    if (token != "") {
        auth = 'token ' + token
    }
    var authHeader={
        headers: {
            'Authorization': auth
        }
    }
    const url = "https://api.github.com/orgs/" + org;
    var organization = await getOrganization(url, authHeader)
    console.log("Nombre: " + organization.name)
    console.log("Descripción: " + organization.description)
    console.log("Enlace: " + organization.blog + "\n")

    var promisesRepositoryPages = []
    console.log("  Repositorios:\n")
    var repositoryPages = await getRepositoryPages(url, authHeader,promisesRepositoryPages)
    
    for (var i = 2; i <= repositoryPages; i++) {
        const promiseRepositoryPage = axios.get(url + "/repos?page=" + i + "&per_page=100", authHeader)
        promisesRepositoryPages.push(promiseRepositoryPage)
    }
    Promise.all(promisesRepositoryPages).then((responses) => {
        var repositoriesPromisesTotal = []
        for (var i = 0; i < responses.length; i++) {
            var repositoriesPromises= getRepositories(responses[i],organization,org,authHeader)
            for(var j = 0;j<repositoriesPromises.length;j++){
                repositoriesPromisesTotal.push(repositoriesPromises[j])
            }
        }
        Promise.all(repositoriesPromisesTotal).then(repositories => {
            for(var repository of repositories){
                totalIssues += repository.issues
                totalCommits += repository.commits

                console.log("       - " + repository.repositoryName)
                console.log("           * Número de Issues abiertas: " + repository.openIssues)
                console.log("           * Numero de commits: " + repository.commits)
            }
            console.log("\nTotal:\n")
            console.log("       - Número de Issues en todos los repositorios: " + totalIssues)
            console.log("       - Número de commits en todos los repositorios: " + totalCommits)
        })
    }).catch(err => {
        console.log('Catch', err);
    });
}

readline.question('Introduce a organization: ', url => {
    const org = url.split("/")
    readline.question('Do you want to use an access token? Y/N: ', ans => {
        if (ans === "Y") {
            readline.question('Introduce your access token: ', token => {
                getOrganizationInfo(org[org.length - 1], token);
                readline.close();
            });
        } else {
            getOrganizationInfo(org[org.length - 1], "");
            readline.close();
        }
    });
});