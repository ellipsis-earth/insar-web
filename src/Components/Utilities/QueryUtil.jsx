const createReactClass = require('create-react-class');

const QueryUtil = createReactClass({
  statics: {
    postData: async (url, body, header = { "Content-Type": "application/json" }) => {
      if(url)
      {      
        try
        {
          let response;
          if(body)
          {
            if (!header['Content-Type'])
            {
              header['Content-Type'] = "application/json";
            }
            response = await fetch(url, 
            {
              method:   'POST',
              headers:  header,
              body:     JSON.stringify(body),
            });
          }
          else
          {
            response = await fetch(url);
          }

          let responseJson = await response.text();
          if (response.status === 200)
          {
            try
            {
              responseJson = JSON.parse(responseJson);
            }
            catch (e){}
            return responseJson
          }
        }
        catch(error)
        {
          throw new Error(error);
        }
      }
      else
      {
        throw new Error('Invalid Query URL');
      }
    },
    getData: async (url, header) => {
      if(url)
      {
        try
        {
          let response;
          response = await fetch(url, 
          {
            method:   'GET',
            headers:  header,
          });

          let responseJson = await response.text();
          if (response.status === 200)
          {
            try
            {
              responseJson = JSON.parse(responseJson);
            }
            catch (e){}
            return responseJson
          }
        }
        catch(error)
        {
          throw new Error(error);
        }
      }
      else
      {
        throw new Error('Invalid Query URL');
      }
    },
  },
  render() {
    return;
  },
});

export default QueryUtil;