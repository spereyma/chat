var static = require('node-static');
var http = require('http');
var file = new(static.Server)();
var app = http.createServer(function (req, res) { file.serve(req, res); }).listen(8000);
var io = require('socket.io').listen(app); 

var Room = require('./room.js');  
var uuid = require('node-uuid');

//io.set("log level", 1);                                                             console.log(''); 
var people_obj = {};  //people_obj[client.id] = {"name" : name, "room" : roomID};
var rooms_obj = {};  
var clients_array = []; //clients_array.push(client);

console.log('server_e1'); 

io.sockets.on("connection", function (client) 
{ 
   	console.log('connection con '+client.id);  
  	
  	client.on("join", function(name) 
  	{
  		console.log('join name='+name);
    	roomID = null;
        people_obj[client.id] = {"name" : name, "room" : roomID};
    	client.emit("update", "You have connected to the server.<br>");
    	io.sockets.emit("update", people_obj[client.id].name + " is online.<br>")
    	io.sockets.emit("update-people", people_obj);//$('#people').append(obj['name']
    	//for (x in client.adapter.rooms[client.id]) {  console.log(x+'='+client.adapter.rooms[client.id][x]); }//-------------------
    	io.sockets.emit("roomList",client.adapter.rooms, rooms_obj, people_obj);
        clients_array.push(client); //populate the clients array with the client object
 	});
	client.on("createRoom", function(name) 
	{ 
		console.log('createRoom name = '+name);  
  		if (people_obj[client.id].room === null) //people_obj[client.id] = {"name" : name, "room" : roomID};
  		{
    		var id = uuid.v4();
    		
    		var room_class = new Room(name, id, client.id);    		
    		rooms_obj[id] = room_class;
    		room_class.addPerson(client.id); //also add the person to the room object

    		//io.sockets.emit("roomList", {rooms_obj: rooms_obj}); // отправить всем пользователям, включая отправителя
    		client.room = name; //name the room
    		client.join(client.room); //auto-join the creator to the room
     		io.sockets.emit("roomList",client.adapter.rooms, rooms_obj, people_obj);   		
    		people_obj[client.id].room = id; //update the room key with the ID of the created room
  		} 
  		else 
  		{
    		io.sockets.emit("update", "You have already created a room.<br>");// ??? отправить всем пользователям, включая отправителя
  		}
	});
	client.on("joinRoom", function(id) 
	{ 
		console.log('join to Room name = '+id);   
    	var room = rooms_obj[id];
    	if (client.id === room.owner) 
    	{
    		console.log('you are owner');
      		client.emit("update", "You are the owner of this room and you have already been joined.<br>");
   		} 
    	else 
    	{
    		console.log(room.people);    		
    		console.log('paso1');
      		room.people.contains(client.id, function(found) 
      		{   console.log('contains ');
          		if (found) { console.log('contains_true '); client.emit("update", "You have already joined this room.<br>"); } 
          		else 
          		{    
          			console.log('contains_false ');
            		if (people_obj[client.id].room !== null) //make sure that one person joins one room at a time
            		{ 
              			
              			client.emit("update", "You are already in a room ("+rooms_obj[people_obj[client.id].room].name+"), please leave it first to join another room.<br>");
            		} 
            		else 
            		{
            			
          				room.addPerson(client.id);
          				people_obj[client.id].room = id;
          				client.room = room.name;
          				client.join(client.room); //add person to the room
          				user = people_obj[client.id];
          				io.sockets.in(client.room).emit("update", user.name + " has connected to " + room.name + " room.<br>");
          				client.emit("update", "Welcome to " + room.name + ".<br>");
          				io.sockets.emit("roomList",client.adapter.rooms, rooms_obj, people_obj); 
          				//client.emit("sendRoomID", {id: id});
           			}
         		}
      		});
    	}
	});
	client.on("send", function(msg) 
	{  
  		//if (io.sockets.manager.roomClients[client.id]['/'+client.room] !== undefined )
  		if (client.adapter.rooms[client.room][client.id]  )  		
  		{
    		io.sockets.in(client.room).emit("chat", people_obj[client.id].name, msg+'<br>');
  		} 
  		else { client.emit("update", "Please connect to a room.<br>");}
	});
	client.on("leaveRoom", function(id) 
{  
  var room = rooms_obj[id];
  if (client.id === room.owner) 
  {
    var i = 0;
    while(i < clients_array.length) 
    {
      if(clients_array[i].id == room.people[i]) 
      {
        people_obj[clients_array[i].id].room = null;
        clients_array[i].leave(room.name);
      }
      ++i;
    }
    delete client.adapter.rooms[room.name];    
    delete rooms_obj[id];
    people_obj[room.owner].room = null; //reset the owns object to null so new room can be added
    
    io.sockets.emit("roomList",client.adapter.rooms, rooms_obj, people_obj);
    var user = people_obj[client.id];
    io.sockets.in(client.room).emit("update", "The owner (" +user.name + ") is leaving the room.<br> The room is removed.<br>");
  } 
  else 
  {
      room.people.contains(client.id, function(found) 
      {
        if (found) //make sure that the client is in fact part of this room
        { 
          var personIndex = room.people.indexOf(client.id);
          room.people.splice(personIndex, 1);
          io.sockets.emit("update", people_obj[client.id].name + " has left the room.<br>");
          client.leave(room.name);
          io.sockets.emit("roomList",client.adapter.rooms, rooms_obj, people_obj);
        }
     });
   }
});
	client.on("removeRoom", function(id) 
	{  
    	var room = rooms_obj[id];
    	if (room) 
    	{
      		if (client.id === room.owner)  //only the owner can remove the room
      		{
        		var personCount = room.people.length;
        		if (personCount > 2) 
        		{
          			console.log('there are still people in the room warning'); //This will be handled later
        		}  
        		else 
        		{
          			if (client.id === room.owner) 
          			{
            			io.sockets.in(client.room).emit("update", "The owner (" +people_obj[client.id].name + ") removed the room.<br>");
            			var i = 0;
            			while(i < clients_array.length) 
            			{
              				if(clients_array[i].id === room.people[i]) {  people_obj[clients_array[i].id].room = null; clients_array[i].leave(room.name); }
              				++i;
            			}
            			delete client.adapter.rooms[room.name]; 
            			delete rooms_obj[id];
            			people_obj[room.owner].room = null;
            			io.sockets.emit("roomList",client.adapter.rooms, rooms_obj, people_obj);
          			}
        		}
      		} 
      		else { client.emit("update", "Only the owner can remove a room.<br>");}
    	}
    	else { client.emit("update", "Кімната з таким імям не знайдена.<br>");}
	});
	client.on("disconnect", function() 
	{  
		if(people_obj[client.id])  console.log('disconnect name='+people_obj[client.id].name);
		else   console.log('disconnect sin join');

		
    	if (people_obj[client.id]) 
    	{
      		if (people_obj[client.id].room === null) //fallo inroom
      		{
       			io.sockets.emit("update", people_obj[client.id].name + " has left the server.<br>");
        		delete people_obj[client.id];
        		io.sockets.emit("update-people", people_obj);
        		//delete client.adapter.rooms['myroom'];
        		io.sockets.emit("roomList",client.adapter.rooms, rooms_obj, people_obj);
      		} 
      		else 
      		{
        		if (people_obj[client.id].room !== null) //fallo  owns
        		{
          			var room= rooms_obj[people_obj[client.id].room];//fallo  owns
          			if (client.id === room.owner) 
          			{
            			var i = 0;
            			while(i < clients_array.length) 
            			{
              				if (clients_array[i].id === room.people[i]) 
              				{ 
              					people_obj[clients_array[i].id].room = null; //fallo inroom
              					clients_array[i].leave(room.name); 
              				}
             			    ++i;
            			}
            			delete rooms_obj[people_obj[client.id].room]; //fallo owns
          			}
        		}
        		io.sockets.emit("update", people_obj[client.id].name + " has left the server.<br>");
        		delete people_obj[client.id];
        		io.sockets.emit("update-people", people_obj);
        		//client.leave('myroom');
        		io.sockets.emit("roomList",client.adapter.rooms, rooms_obj, people_obj);  
     		 }
    }
  });
    
    client.room = 'myroom';
    client.join('myroom');  //кожен хто робить коннект, запишеться в цю кімнату.
	
	Array.prototype.contains = function(k, callback) 
	{  
    var self = this;
    return(function check(i) //en este caso i==0, mira 5 filas mas abajo
    {
        if (i >= self.length) { return callback(false);}
        if (self[i] === k) { return callback(true);}
        return process.nextTick(check.bind(null, i+1));
    }(0));
   };
}); 



 	//console.log('io.sockets.manager.roomClients[client.id]'); //should return { '': true }  
    //console.log('io.sockets.manager.roomClients[client.id]'); //should return { '': true, '/myroom': true } 